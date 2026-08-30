use std::future::Future;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::result::Result as StdResult;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::{multipart, Client, Response};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::config::PaddleRuntimeConfig;
use crate::ocr_provider::paddle::errors::PaddleProviderError;
use crate::ocr_provider::paddle::models::{
    PaddleJsonlLine, PaddlePollData, PaddlePollEnvelope, PaddleSubmitEnvelope,
};
use crate::ocr_provider::types::OcrProviderCapabilities;

const PYTHON_SUBMIT_ATTEMPTS: u64 = 3;

#[derive(Debug, Clone)]
pub struct PaddleClient {
    pub base_url: String,
    pub token: String,
    http: Client,
    runtime: PaddleRuntimeConfig,
}

#[derive(Debug, Clone)]
pub struct PaddleTrace<T> {
    pub data: T,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PaddleResultPayload {
    pub payload: Value,
}

impl PaddleClient {
    pub fn new(base_url: impl Into<String>, token: impl Into<String>) -> Self {
        Self::with_runtime(base_url, token, PaddleRuntimeConfig::from_env())
    }

    pub fn with_runtime(
        base_url: impl Into<String>,
        token: impl Into<String>,
        runtime: PaddleRuntimeConfig,
    ) -> Self {
        let base_url = {
            let raw = base_url.into();
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                runtime.default_base_url.trim_end_matches('/').to_string()
            } else {
                trimmed.trim_end_matches('/').to_string()
            }
        };
        let http = build_http_client(&runtime);
        Self {
            base_url,
            token: token.into(),
            http,
            runtime,
        }
    }

    pub async fn submit_local_file(
        &self,
        file_path: &Path,
        model: &str,
        page_ranges: &str,
        optional_payload: &Value,
    ) -> Result<PaddleTrace<String>> {
        if should_use_python_submit(&self.base_url) {
            return self
                .submit_local_file_with_python(file_path, model, page_ranges, optional_payload)
                .await;
        }
        self.submit_local_file_with_reqwest(file_path, model, page_ranges, optional_payload)
            .await
    }

    async fn submit_local_file_with_reqwest(
        &self,
        file_path: &Path,
        model: &str,
        page_ranges: &str,
        optional_payload: &Value,
    ) -> Result<PaddleTrace<String>> {
        let file_name = file_path
            .file_name()
            .and_then(|item| item.to_str())
            .ok_or_else(|| anyhow!("invalid upload filename"))?
            .to_string();
        let file_bytes = tokio::fs::read(file_path)
            .await
            .with_context(|| format!("failed to read upload file {}", file_path.display()))?;
        let optional_payload_json = serde_json::to_string(optional_payload)?;
        let url = format!("{}/api/v2/ocr/jobs", self.base_url);
        let file_name_for_retry = file_name.clone();
        let file_bytes_for_retry = file_bytes.clone();
        let optional_payload_for_retry = optional_payload_json.clone();
        let model_for_retry = model.to_string();
        let page_ranges_for_retry = page_ranges.trim().to_string();
        let response = self
            .send_with_retry("submit", move || {
                let file_part = multipart::Part::bytes(file_bytes_for_retry.clone())
                    .file_name(file_name_for_retry.clone());
                let mut form = multipart::Form::new()
                    .text("model", model_for_retry.clone())
                    .text("optionalPayload", optional_payload_for_retry.clone())
                    .part("file", file_part);
                if !page_ranges_for_retry.is_empty() {
                    form = form.text("pageRanges", page_ranges_for_retry.clone());
                }
                self.http
                    .post(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .multipart(form)
                    .send()
            })
            .await?;
        let envelope = parse_json_response::<PaddleSubmitEnvelope>("submit", response).await?;
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "submit",
                envelope.error_code,
                &envelope.error_msg,
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        let data = envelope.data.ok_or_else(|| {
            anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit missing data",
                normalize_trace_id(&envelope.log_id).as_deref(),
            ))
        })?;
        if data.job_id.trim().is_empty() {
            return Err(anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit returned empty jobId",
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        Ok(PaddleTrace {
            data: data.job_id,
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    async fn submit_local_file_with_python(
        &self,
        file_path: &Path,
        model: &str,
        page_ranges: &str,
        optional_payload: &Value,
    ) -> Result<PaddleTrace<String>> {
        let helper_path = paddle_submit_helper_path();
        let python_bin = std::env::var("PYTHON_BIN")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "python3".to_string());
        let request = json!({
            "token": self.token.trim(),
            "file_path": file_path,
            "model": model,
            "page_ranges": page_ranges.trim(),
            "optional_payload": optional_payload,
            "base_url": self.base_url,
            "timeout_secs": self.runtime.request_timeout_secs,
        });
        let request_bytes = serde_json::to_vec(&request)?;
        let mut command = Command::new(python_bin);
        command
            .arg("-u")
            .arg(&helper_path)
            // A timed-out submit may already have created a remote OCR task.
            // Avoid duplicate Paddle jobs; the user can explicitly retry instead.
            .env("RETAIN_PADDLE_RETRY_ATTEMPTS", "1")
            .env(
                "RETAIN_PADDLE_SUBMIT_RETRY_ATTEMPTS",
                PYTHON_SUBMIT_ATTEMPTS.to_string(),
            )
            .env(
                "RETAIN_PADDLE_RETRY_BACKOFF_SECONDS",
                (self.runtime.request_retry_base_delay_millis as f64 / 1000.0).to_string(),
            )
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        if let Some(project_root) = project_root_from_env() {
            command.current_dir(project_root);
        }

        let mut child = command.spawn().with_context(|| {
            format!(
                "failed to start Paddle submit helper {}",
                helper_path.display()
            )
        })?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("Paddle submit helper stdin is unavailable"))?;
        stdin.write_all(&request_bytes).await?;
        drop(stdin);

        let timeout_secs = python_submit_helper_timeout_secs(self.runtime.request_timeout_secs);
        let output = tokio::time::timeout(
            Duration::from_secs(timeout_secs.max(1)),
            child.wait_with_output(),
        )
        .await
        .map_err(|_| anyhow!("Paddle submit helper timed out after {timeout_secs} seconds"))??;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let response = serde_json::from_str::<PaddleSubmitBridgeOutput>(&stdout).map_err(|err| {
            anyhow!(
                "invalid Paddle submit helper response: {err}; stderr={}",
                sanitize_process_output(&stderr)
            )
        })?;
        if !output.status.success() || !response.ok {
            let detail = python_submit_failure_detail(&response.error, &stderr);
            return Err(anyhow!("Paddle submit helper failed: {detail}"));
        }
        if response.job_id.trim().is_empty() {
            return Err(anyhow!("Paddle submit helper returned empty jobId"));
        }
        Ok(PaddleTrace {
            data: response.job_id,
            trace_id: normalize_trace_id(&response.trace_id),
        })
    }

    pub async fn submit_remote_url(
        &self,
        source_url: &str,
        model: &str,
        page_ranges: &str,
        optional_payload: &Value,
    ) -> Result<PaddleTrace<String>> {
        let payload = build_remote_submit_payload(source_url, model, page_ranges, optional_payload);
        let url = format!("{}/api/v2/ocr/jobs", self.base_url);
        let response = self
            .send_with_retry("submit", || {
                self.http
                    .post(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .header(CONTENT_TYPE, "application/json")
                    .json(&payload)
                    .send()
            })
            .await?;
        let envelope = parse_json_response::<PaddleSubmitEnvelope>("submit", response).await?;
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "submit",
                envelope.error_code,
                &envelope.error_msg,
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        let data = envelope.data.ok_or_else(|| {
            anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit missing data",
                normalize_trace_id(&envelope.log_id).as_deref(),
            ))
        })?;
        if data.job_id.trim().is_empty() {
            return Err(anyhow::Error::new(PaddleProviderError::invalid_response(
                "submit",
                "Paddle submit returned empty jobId",
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        Ok(PaddleTrace {
            data: data.job_id,
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn query_job(&self, job_id: &str) -> Result<PaddleTrace<PaddlePollData>> {
        let url = format!("{}/api/v2/ocr/jobs/{}", self.base_url, job_id);
        let response = self
            .send_with_retry("poll", || {
                self.http
                    .get(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .send()
            })
            .await?;
        let envelope = parse_json_response::<PaddlePollEnvelope>("poll", response).await?;
        if envelope.error_code != 0 {
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "poll",
                envelope.error_code,
                &envelope.error_msg,
                normalize_trace_id(&envelope.log_id).as_deref(),
            )));
        }
        Ok(PaddleTrace {
            data: envelope.data.unwrap_or_default(),
            trace_id: normalize_trace_id(&envelope.log_id),
        })
    }

    pub async fn probe_token(&self) -> Result<PaddleTrace<()>> {
        let probe_job_id = format!("retain-pdf-token-probe-{}", fastrand::u64(..));
        let url = format!("{}/api/v2/ocr/jobs/{}", self.base_url, probe_job_id);
        let response = self
            .send_with_retry("probe", || {
                self.http
                    .get(&url)
                    .header(AUTHORIZATION, self.auth_header())
                    .send()
            })
            .await?;
        let status = response.status();
        let bytes = response.bytes().await.map_err(|err| {
            anyhow::Error::new(PaddleProviderError::request_failed("probe", &err, None))
        })?;
        let body_text = String::from_utf8_lossy(&bytes).to_string();
        let envelope = serde_json::from_slice::<PaddlePollEnvelope>(&bytes).ok();
        let trace_id = envelope
            .as_ref()
            .and_then(|parsed| normalize_trace_id(&parsed.log_id));

        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(PaddleTrace { data: (), trace_id });
        }

        if !status.is_success() {
            return Err(anyhow::Error::new(PaddleProviderError::http_status(
                "probe",
                status,
                &body_text,
                trace_id.as_deref(),
                None,
            )));
        }

        if let Some(parsed) = envelope {
            if parsed.error_code == 0 || parsed.error_code == 404 || parsed.error_code == 11001 {
                return Ok(PaddleTrace {
                    data: (),
                    trace_id: normalize_trace_id(&parsed.log_id),
                });
            }
            return Err(anyhow::Error::new(PaddleProviderError::provider_error(
                "probe",
                parsed.error_code,
                &parsed.error_msg,
                normalize_trace_id(&parsed.log_id).as_deref(),
            )));
        }

        Err(anyhow::Error::new(PaddleProviderError::invalid_response(
            "probe",
            format!("failed to parse Paddle probe JSON: {body_text}"),
            None,
        )))
    }

    pub async fn download_jsonl_result(&self, jsonl_url: &str) -> Result<PaddleResultPayload> {
        let text = self
            .send_with_retry("download", || {
                self.http
                    .get(jsonl_url)
                    .timeout(Duration::from_secs(self.runtime.download_timeout_secs))
                    .send()
            })
            .await?
            .error_for_status()
            .map_err(|err| {
                let status = err.status().map(|value| value.as_u16());
                anyhow::Error::new(PaddleProviderError::result_download_failed(
                    format!("Paddle download jsonl returned error status: {err}"),
                    None,
                    status,
                ))
            })?
            .text()
            .await
            .map_err(|err| {
                anyhow::Error::new(PaddleProviderError::request_failed("download", &err, None))
            })?;
        let payload = combine_jsonl_payload(&text)?;
        Ok(PaddleResultPayload { payload })
    }

    fn auth_header(&self) -> String {
        format!("bearer {}", self.token.trim())
    }

    async fn send_with_retry<F, Fut>(&self, stage: &'static str, mut action: F) -> Result<Response>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = StdResult<Response, reqwest::Error>>,
    {
        let mut last_error: Option<reqwest::Error> = None;
        let mut attempts_made = 0usize;
        let configured_attempts = self.runtime.request_retry_attempts.max(1);
        for attempt in 1..=configured_attempts {
            attempts_made = attempt;
            match action().await {
                Ok(response) => return Ok(response),
                Err(err) => {
                    let retryable = is_retryable_transport_error(&err);
                    let attempt_limit = retry_limit_for_error(&err, configured_attempts);
                    tracing::warn!(
                        provider = "paddle",
                        stage,
                        attempt,
                        attempt_limit,
                        error = %err,
                        "Paddle request failed"
                    );
                    last_error = Some(err);
                    if !retryable || attempt >= attempt_limit {
                        break;
                    }
                    let delay = Duration::from_millis(
                        self.runtime.request_retry_base_delay_millis * attempt as u64,
                    );
                    tokio::time::sleep(delay).await;
                }
            }
        }
        let err = last_error.expect("Paddle request retry loop should capture last error");
        Err(anyhow::Error::new(
            PaddleProviderError::request_failed_after_attempts(stage, &err, None, attempts_made),
        ))
    }
}

#[derive(Debug, Deserialize, Default)]
struct PaddleSubmitBridgeOutput {
    #[serde(default)]
    ok: bool,
    #[serde(default)]
    job_id: String,
    #[serde(default)]
    trace_id: String,
    #[serde(default)]
    error: String,
}

fn should_use_python_submit(base_url: &str) -> bool {
    reqwest::Url::parse(base_url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .is_some_and(|host| host.eq_ignore_ascii_case("paddleocr.aistudio-app.com"))
}

fn project_root_from_env() -> Option<PathBuf> {
    std::env::var("PROJECT_ROOT")
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

fn paddle_submit_helper_path() -> PathBuf {
    if let Some(path) = std::env::var("RUST_API_PADDLE_SUBMIT_HELPER")
        .ok()
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
    {
        return path;
    }
    if let Some(scripts_dir) = std::env::var("RUST_API_SCRIPTS_DIR")
        .ok()
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
    {
        return scripts_dir
            .join("entrypoints")
            .join("paddle_submit_bridge.py");
    }
    if let Some(project_root) = project_root_from_env() {
        return project_root
            .join("backend")
            .join("scripts")
            .join("entrypoints")
            .join("paddle_submit_bridge.py");
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("scripts")
        .join("entrypoints")
        .join("paddle_submit_bridge.py")
}

fn sanitize_process_output(text: &str) -> String {
    let single_line = text.trim().replace(['\r', '\n'], " ");
    single_line.chars().take(500).collect()
}

fn python_submit_helper_timeout_secs(request_timeout_secs: u64) -> u64 {
    request_timeout_secs
        .saturating_mul(PYTHON_SUBMIT_ATTEMPTS)
        .saturating_add(30)
}

fn python_submit_failure_detail(error: &str, stderr: &str) -> String {
    let error = error.trim();
    let stderr = sanitize_process_output(stderr);
    match (error.is_empty(), stderr.is_empty()) {
        (false, false) => format!("{error}; helper_stderr={stderr}"),
        (false, true) => error.to_string(),
        (true, false) => stderr,
        (true, true) => "Paddle submit helper exited without an error message".to_string(),
    }
}

fn build_http_client(runtime: &PaddleRuntimeConfig) -> Client {
    Client::builder()
        .connect_timeout(Duration::from_secs(runtime.connect_timeout_secs.max(1)))
        .timeout(Duration::from_secs(runtime.request_timeout_secs))
        .http1_only()
        .no_proxy()
        .build()
        .expect("reqwest client")
}

fn is_retryable_transport_error(err: &reqwest::Error) -> bool {
    err.is_connect() || err.is_timeout() || err.is_body()
}

fn retry_limit_for_error(err: &reqwest::Error, configured_attempts: usize) -> usize {
    if err.is_connect() || error_chain_has_connection_failure(err) {
        configured_attempts.max(1)
    } else if err.is_timeout() || err.is_body() {
        configured_attempts.clamp(1, 2)
    } else {
        1
    }
}

fn error_chain_has_connection_failure(err: &reqwest::Error) -> bool {
    let mut current: Option<&(dyn std::error::Error + 'static)> = Some(err);
    while let Some(error) = current {
        if looks_like_connection_failure(&error.to_string()) {
            return true;
        }
        current = error.source();
    }
    false
}

fn looks_like_connection_failure(detail: &str) -> bool {
    let detail = detail.to_ascii_lowercase();
    detail.contains("connection timed out")
        || detail.contains("connect timeout")
        || detail.contains("connection error")
}

fn build_remote_submit_payload(
    source_url: &str,
    model: &str,
    page_ranges: &str,
    optional_payload: &Value,
) -> Value {
    let mut payload = json!({
        "fileUrl": source_url,
        "model": model,
        "optionalPayload": optional_payload,
    });
    let page_ranges = page_ranges.trim();
    if !page_ranges.is_empty() {
        payload["pageRanges"] = Value::String(page_ranges.to_string());
    }
    payload
}

pub fn normalize_model_name(model: &str) -> String {
    crate::ocr_provider::normalize_paddle_model_name(model)
}

pub fn capabilities() -> OcrProviderCapabilities {
    OcrProviderCapabilities {
        supports_remote_url_submit: true,
        supports_local_file_upload: true,
        supports_polling: true,
        supports_download_bundle: false,
        supports_extra_formats: false,
        supports_formula_toggle: false,
        supports_table_toggle: false,
    }
}

fn normalize_trace_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

async fn parse_json_response<T: serde::de::DeserializeOwned>(
    stage: &'static str,
    response: reqwest::Response,
) -> Result<T> {
    let status = response.status();
    let bytes = response.bytes().await.map_err(|err| {
        anyhow::Error::new(PaddleProviderError::request_failed(stage, &err, None))
    })?;
    if !status.is_success() {
        return Err(anyhow::Error::new(PaddleProviderError::http_status(
            stage,
            status,
            &String::from_utf8_lossy(&bytes),
            None,
            None,
        )));
    }
    let envelope = serde_json::from_slice::<T>(&bytes).with_context(|| {
        format!(
            "failed to parse Paddle JSON: {}",
            String::from_utf8_lossy(&bytes)
        )
    })?;
    Ok(envelope)
}

fn combine_jsonl_payload(text: &str) -> Result<Value> {
    let mut layout_results = Vec::new();
    let mut data_info = Value::Object(Default::default());
    let mut line_count = 0usize;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        line_count += 1;
        let parsed: PaddleJsonlLine = serde_json::from_str(trimmed).map_err(|err| {
            anyhow::Error::new(PaddleProviderError::result_unpack_failed(
                format!("failed to parse Paddle JSONL line: {trimmed}; {err}"),
                None,
            ))
        })?;
        let Some(result) = parsed.result else {
            continue;
        };
        if let Some(items) = result
            .get("layoutParsingResults")
            .and_then(|v| v.as_array())
        {
            layout_results.extend(items.iter().cloned());
        }
        if result.get("dataInfo").is_some()
            && data_info.as_object().map(|m| m.is_empty()).unwrap_or(true)
        {
            data_info = result.get("dataInfo").cloned().unwrap_or_else(|| json!({}));
        }
    }
    Ok(json!({
        "layoutParsingResults": layout_results,
        "dataInfo": data_info,
        "_meta": {
            "source": "paddle_jsonl",
            "lineCount": line_count,
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        build_remote_submit_payload, combine_jsonl_payload, looks_like_connection_failure,
        normalize_model_name, python_submit_failure_detail, python_submit_helper_timeout_secs,
        PaddleClient,
    };
    use crate::config::PaddleRuntimeConfig;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[test]
    fn remote_submit_payload_includes_page_ranges() {
        let payload = build_remote_submit_payload(
            "https://example.com/book.pdf",
            "PaddleOCR-VL-1.6",
            " 7-12 ",
            &json!({"useDocUnwarping": false}),
        );

        assert_eq!(payload["fileUrl"], "https://example.com/book.pdf");
        assert_eq!(payload["model"], "PaddleOCR-VL-1.6");
        assert_eq!(payload["pageRanges"], "7-12");
        assert_eq!(payload["optionalPayload"]["useDocUnwarping"], false);
    }

    #[test]
    fn remote_submit_payload_omits_empty_page_ranges() {
        let payload = build_remote_submit_payload(
            "https://example.com/book.pdf",
            "PaddleOCR-VL-1.6",
            " ",
            &json!({}),
        );

        assert!(payload.get("pageRanges").is_none());
    }

    #[test]
    fn python_submit_timeout_covers_all_transport_attempts() {
        assert_eq!(python_submit_helper_timeout_secs(900), 2730);
    }

    #[test]
    fn python_submit_failure_keeps_sanitized_retry_diagnostics() {
        let detail = python_submit_failure_detail(
            "network request failed",
            "Paddle OCR submit transport retry 1/3\nPaddle OCR submit transport retry 2/3",
        );

        assert!(detail.contains("network request failed"));
        assert!(detail.contains("transport retry 1/3 Paddle OCR submit transport retry 2/3"));
    }

    #[tokio::test]
    async fn local_submit_multipart_includes_page_ranges() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut buffer = [0u8; 4096];
            loop {
                let bytes_read = socket.read(&mut buffer).await.unwrap();
                if bytes_read == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..bytes_read]);
                if request_body_complete(&request) {
                    break;
                }
            }
            let body = r#"{"errorCode":0,"errorMsg":"Success","logId":"trace-test","data":{"jobId":"paddle-test"}}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            socket.write_all(response.as_bytes()).await.unwrap();
            String::from_utf8_lossy(&request).into_owned()
        });

        let runtime = PaddleRuntimeConfig {
            default_base_url: format!("http://{address}"),
            connect_timeout_secs: 2,
            request_timeout_secs: 5,
            download_timeout_secs: 5,
            request_retry_attempts: 1,
            request_retry_base_delay_millis: 1,
            max_input_images: 100,
            allow_private_urls: true,
        };
        let client = PaddleClient::with_runtime(format!("http://{address}"), "test-token", runtime);
        let file_path =
            std::env::temp_dir().join(format!("retainpdf-paddle-submit-{}.pdf", fastrand::u64(..)));
        tokio::fs::write(&file_path, b"%PDF-1.4\n").await.unwrap();

        let result = client
            .submit_local_file(
                &file_path,
                "PaddleOCR-VL-1.6",
                "7-12",
                &json!({"useDocUnwarping": false}),
            )
            .await
            .unwrap();
        let _ = tokio::fs::remove_file(&file_path).await;
        let request = server.await.unwrap();

        assert_eq!(result.data, "paddle-test");
        assert!(request.contains("name=\"pageRanges\""));
        assert!(request.contains("\r\n\r\n7-12\r\n"));
    }

    fn request_body_complete(request: &[u8]) -> bool {
        let Some(header_end) = request.windows(4).position(|item| item == b"\r\n\r\n") else {
            return false;
        };
        let header_end = header_end + 4;
        let headers = String::from_utf8_lossy(&request[..header_end]);
        let content_length = headers.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())
                .flatten()
        });
        content_length
            .map(|length| request.len() >= header_end + length)
            .unwrap_or(false)
    }

    #[test]
    fn combine_jsonl_payload_merges_layout_results_and_data_info() {
        let payload = r#"
{"result":{"layoutParsingResults":[{"page":1}],"dataInfo":{"pages":[{"width":100}]}}}
{"result":{"layoutParsingResults":[{"page":2}]}}
"#;

        let merged = combine_jsonl_payload(payload).expect("merged payload");

        assert_eq!(
            merged["layoutParsingResults"].as_array().map(|v| v.len()),
            Some(2)
        );
        assert_eq!(merged["dataInfo"]["pages"][0]["width"], 100);
        assert_eq!(merged["_meta"]["source"], "paddle_jsonl");
        assert_eq!(merged["_meta"]["lineCount"], 2);
    }

    #[test]
    fn combine_jsonl_payload_reports_unpack_error_for_bad_line() {
        let err = combine_jsonl_payload("not-json").expect_err("expected error");
        let provider = err
            .downcast_ref::<crate::ocr_provider::paddle::errors::PaddleProviderError>()
            .expect("paddle provider error");

        assert_eq!(
            provider.info().category,
            crate::ocr_provider::types::OcrErrorCategory::ResultUnpackFailed
        );
    }

    #[test]
    fn normalize_model_name_maps_known_aliases() {
        assert_eq!(normalize_model_name(""), "PaddleOCR-VL-1.5");
        assert_eq!(normalize_model_name("paddle-ocr-vl"), "PaddleOCR-VL-1.5");
        assert_eq!(
            normalize_model_name("paddle-ocr-vl-1.5"),
            "PaddleOCR-VL-1.5"
        );
        assert_eq!(normalize_model_name("paddleocr-vl-1.5"), "PaddleOCR-VL-1.5");
        assert_eq!(
            normalize_model_name("paddle-ocr-vl-1.6"),
            "PaddleOCR-VL-1.6"
        );
    }

    #[test]
    fn connection_timeout_detail_is_treated_as_connect_failure() {
        assert!(looks_like_connection_failure(
            "client error (SendRequest): connection error: Connection timed out (os error 110)"
        ));
        assert!(!looks_like_connection_failure(
            "request timed out while waiting for the response body"
        ));
    }
}
