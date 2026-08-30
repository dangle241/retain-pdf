use std::error::Error;
use std::fmt;

use reqwest::StatusCode;
use serde::Deserialize;

use crate::ocr_provider::types::{OcrErrorCategory, OcrProviderErrorInfo};

#[derive(Debug, Clone)]
pub struct PaddleProviderError {
    stage: &'static str,
    detail: String,
    info: OcrProviderErrorInfo,
}

impl PaddleProviderError {
    pub fn request_failed(
        stage: &'static str,
        err: &reqwest::Error,
        trace_id: Option<&str>,
    ) -> Self {
        Self::request_failed_after_attempts(stage, err, trace_id, 1)
    }

    pub fn request_failed_after_attempts(
        stage: &'static str,
        err: &reqwest::Error,
        trace_id: Option<&str>,
        attempts: usize,
    ) -> Self {
        if let Some(status) = err.status() {
            return Self::http_status(
                stage,
                status,
                &err.to_string(),
                trace_id,
                Some("Paddle HTTP trả về trạng thái lỗi"),
            );
        }
        let category = if err.is_timeout() {
            OcrErrorCategory::RemoteReadTimeout
        } else {
            OcrErrorCategory::ServiceUnavailable
        };
        let failure_kind = if err.is_connect() && err.is_timeout() {
            "Paddle connection timeout"
        } else if err.is_connect() {
            "Paddle connection failed"
        } else if err.is_timeout() {
            "Paddle request timeout"
        } else if err.is_body() {
            "Paddle upload body failed"
        } else {
            "Paddle request failed"
        };
        let detail = format!(
            "{failure_kind} after {} attempt(s): {}",
            attempts.max(1),
            reqwest_error_detail(err)
        );
        Self::new(
            stage,
            category,
            detail.clone(),
            trace_id,
            None,
            Some(detail),
            Some("Kiểm tra kết nối Paddle, proxy/VPN và cấu hình timeout rồi thử lại"),
        )
    }

    pub fn http_status(
        stage: &'static str,
        status: StatusCode,
        body_excerpt: &str,
        trace_id: Option<&str>,
        detail: Option<&str>,
    ) -> Self {
        let parsed_error = parse_paddle_error_body(body_excerpt);
        let provider_code = parsed_error
            .as_ref()
            .and_then(|error| error.code.map(|code| code.to_string()));
        let provider_message = parsed_error
            .as_ref()
            .and_then(|error| error.message())
            .or_else(|| sanitize_body_excerpt(body_excerpt));
        let resolved_trace_id = trace_id
            .map(str::to_string)
            .or_else(|| parsed_error.as_ref().and_then(|error| error.trace_id()));
        let category = provider_code
            .as_deref()
            .and_then(category_for_provider_code)
            .unwrap_or_else(|| match status {
                StatusCode::UNAUTHORIZED => OcrErrorCategory::Unauthorized,
                StatusCode::FORBIDDEN => OcrErrorCategory::PermissionDenied,
                StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => {
                    OcrErrorCategory::RemoteReadTimeout
                }
                StatusCode::BAD_REQUEST
                | StatusCode::UNPROCESSABLE_ENTITY
                | StatusCode::METHOD_NOT_ALLOWED => OcrErrorCategory::InvalidRequest,
                StatusCode::TOO_MANY_REQUESTS => OcrErrorCategory::QueueFull,
                StatusCode::SERVICE_UNAVAILABLE | StatusCode::BAD_GATEWAY => {
                    OcrErrorCategory::ServiceUnavailable
                }
                _ if status.is_server_error() => OcrErrorCategory::ServiceUnavailable,
                _ => OcrErrorCategory::HttpStatus,
            });
        let message = format!(
            "HTTP {}{}",
            status.as_u16(),
            sanitize_body_excerpt(body_excerpt)
                .map(|text| format!(": {text}"))
                .unwrap_or_default()
        );
        Self::new(
            stage,
            category,
            detail
                .unwrap_or("Yêu cầu HTTP tới Paddle thất bại")
                .to_string(),
            resolved_trace_id.as_deref(),
            provider_code,
            provider_message.or(Some(message)),
            Some("Kiểm tra địa chỉ Paddle API, token và trạng thái dịch vụ"),
        )
        .with_http_status(status.as_u16())
    }

    pub fn provider_error(
        stage: &'static str,
        provider_code: i64,
        provider_message: &str,
        trace_id: Option<&str>,
    ) -> Self {
        let category =
            category_for_provider_code(&provider_code.to_string()).unwrap_or(match provider_code {
                401 | 403 => OcrErrorCategory::Unauthorized,
                404 => OcrErrorCategory::TaskNotFound,
                408 => OcrErrorCategory::RemoteReadTimeout,
                409 => OcrErrorCategory::OperationNotAllowed,
                429 => OcrErrorCategory::QueueFull,
                code if code >= 500 => OcrErrorCategory::ServiceUnavailable,
                _ => OcrErrorCategory::ProviderFailed,
            });
        Self::new(
            stage,
            category,
            format!("Paddle trả về errorCode={provider_code}"),
            trace_id,
            Some(provider_code.to_string()),
            Some(provider_message.trim().to_string()),
            Some("Kiểm tra provider_message và trace_id do Paddle trả về"),
        )
    }

    pub fn invalid_response(
        stage: &'static str,
        detail: impl Into<String>,
        trace_id: Option<&str>,
    ) -> Self {
        Self::new(
            stage,
            OcrErrorCategory::InvalidProviderResponse,
            detail.into(),
            trace_id,
            None,
            None,
            Some("Kiểm tra phản hồi Paddle có đủ data, jobId và resultUrl.jsonUrl"),
        )
    }

    pub fn provider_failed(provider_message: &str, trace_id: Option<&str>) -> Self {
        Self::new(
            "poll",
            OcrErrorCategory::ProviderFailed,
            "Tác vụ Paddle thực thi thất bại".to_string(),
            trace_id,
            None,
            Some(provider_message.trim().to_string()),
            Some("Kiểm tra provider_message, trace_id và trạng thái tác vụ Paddle"),
        )
    }

    pub fn result_download_failed(
        detail: impl Into<String>,
        trace_id: Option<&str>,
        http_status: Option<u16>,
    ) -> Self {
        Self::new(
            "download",
            OcrErrorCategory::ResultDownloadFailed,
            detail.into(),
            trace_id,
            None,
            None,
            Some("Kiểm tra Paddle jsonUrl có truy cập được không hoặc thử lại sau"),
        )
        .with_http_status_opt(http_status)
    }

    pub fn result_unpack_failed(detail: impl Into<String>, trace_id: Option<&str>) -> Self {
        Self::new(
            "download",
            OcrErrorCategory::ResultUnpackFailed,
            detail.into(),
            trace_id,
            None,
            None,
            Some("Kiểm tra dữ liệu JSONL của Paddle có đầy đủ và hợp lệ không"),
        )
    }

    pub fn poll_timeout(job_id: &str) -> Self {
        Self::new(
            "poll",
            OcrErrorCategory::PollTimeout,
            format!("Timed out waiting for Paddle task {job_id}"),
            None,
            None,
            None,
            Some("Kiểm tra tác vụ Paddle có bị treo hoặc tăng thời gian chờ polling"),
        )
    }

    pub fn info(&self) -> &OcrProviderErrorInfo {
        &self.info
    }

    pub fn stage_detail(&self) -> String {
        let prefix = match self.stage {
            "submit" => "Gửi tác vụ Paddle thất bại",
            "poll" => "Kiểm tra trạng thái Paddle thất bại",
            "download" => "Tải kết quả Paddle thất bại",
            _ => "Nhà cung cấp Paddle thất bại",
        };
        let message = self
            .info
            .provider_message
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(self.detail.as_str());
        let trace_suffix = self
            .info
            .trace_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(|value| format!(" trace_id={value}"))
            .unwrap_or_default();
        format!("{prefix}: {message}{trace_suffix}")
    }

    fn new(
        stage: &'static str,
        category: OcrErrorCategory,
        detail: String,
        trace_id: Option<&str>,
        provider_code: Option<String>,
        provider_message: Option<String>,
        operator_hint: Option<&str>,
    ) -> Self {
        Self {
            stage,
            detail,
            info: OcrProviderErrorInfo {
                category,
                provider_code,
                provider_message,
                operator_hint: operator_hint.map(str::to_string),
                trace_id: trace_id
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                http_status: None,
            },
        }
    }

    fn with_http_status(mut self, http_status: u16) -> Self {
        self.info.http_status = Some(http_status);
        self
    }

    fn with_http_status_opt(mut self, http_status: Option<u16>) -> Self {
        self.info.http_status = http_status;
        self
    }
}

impl fmt::Display for PaddleProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.detail)
    }
}

impl Error for PaddleProviderError {}

fn reqwest_error_detail(err: &reqwest::Error) -> String {
    let mut parts = vec![err.to_string()];
    let mut source = err.source();
    while let Some(cause) = source {
        let message = cause.to_string();
        if !message.trim().is_empty() && !parts.iter().any(|item| item == &message) {
            parts.push(message);
        }
        source = cause.source();
    }
    parts.join(": ")
}

fn sanitize_body_excerpt(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    let single_line = trimmed.replace('\n', " ");
    let excerpt: String = single_line.chars().take(180).collect();
    Some(excerpt)
}

fn category_for_provider_code(code: &str) -> Option<OcrErrorCategory> {
    match code.trim() {
        "10010" | "429" => Some(OcrErrorCategory::QueueFull),
        "401" | "403" => Some(OcrErrorCategory::Unauthorized),
        "404" => Some(OcrErrorCategory::TaskNotFound),
        "408" => Some(OcrErrorCategory::RemoteReadTimeout),
        "409" => Some(OcrErrorCategory::OperationNotAllowed),
        _ => None,
    }
}

#[derive(Debug, Deserialize)]
struct PaddleErrorBody {
    #[serde(default, alias = "errorCode")]
    code: Option<i64>,
    #[serde(default, alias = "errorMsg", alias = "message")]
    msg: Option<String>,
    #[serde(default, rename = "traceId", alias = "logId")]
    trace_id: Option<String>,
}

impl PaddleErrorBody {
    fn message(&self) -> Option<String> {
        self.msg
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    }

    fn trace_id(&self) -> Option<String> {
        self.trace_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    }
}

fn parse_paddle_error_body(text: &str) -> Option<PaddleErrorBody> {
    serde_json::from_str::<PaddleErrorBody>(text.trim()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_status_maps_unauthorized() {
        let err = PaddleProviderError::http_status(
            "submit",
            StatusCode::UNAUTHORIZED,
            r#"{"message":"bad token"}"#,
            Some("trace-1"),
            None,
        );

        assert_eq!(err.info().category, OcrErrorCategory::Unauthorized);
        assert_eq!(err.info().http_status, Some(401));
        assert_eq!(err.info().trace_id.as_deref(), Some("trace-1"));
    }

    #[test]
    fn provider_error_preserves_code_and_message() {
        let err = PaddleProviderError::provider_error("poll", 429, "busy", Some("trace-2"));

        assert_eq!(err.info().category, OcrErrorCategory::QueueFull);
        assert_eq!(err.info().provider_code.as_deref(), Some("429"));
        assert_eq!(err.info().provider_message.as_deref(), Some("busy"));
    }

    #[test]
    fn http_status_extracts_paddle_queue_full_body() {
        let err = PaddleProviderError::http_status(
            "submit",
            StatusCode::BAD_REQUEST,
            r#"{"traceId":"trace-queue","code":10010,"msg":"任务提交队列已满，请稍后重试"}"#,
            None,
            None,
        );

        assert_eq!(err.info().category, OcrErrorCategory::QueueFull);
        assert_eq!(err.info().http_status, Some(400));
        assert_eq!(err.info().provider_code.as_deref(), Some("10010"));
        assert_eq!(
            err.info().provider_message.as_deref(),
            Some("任务提交队列已满，请稍后重试")
        );
        assert_eq!(err.info().trace_id.as_deref(), Some("trace-queue"));
        assert!(err.stage_detail().contains("任务提交队列已满"));
    }

    #[test]
    fn poll_timeout_uses_poll_timeout_category() {
        let err = PaddleProviderError::poll_timeout("job-1");

        assert_eq!(err.info().category, OcrErrorCategory::PollTimeout);
        assert!(err.to_string().contains("job-1"));
    }
}
