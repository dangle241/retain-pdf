//! retainpdf-ai 服务的反向代理。
//!
//! 前端保持单一入口(Rust API)与单一 X-API-Key:本路由把请求转发到
//! 常驻 AI 服务并透传客户端的 X-API-Key(两个服务共享同一 key 集合即可,
//! 零新增前端配置)。SSE 流式响应按字节流透传。

use axum::body::Body;
use axum::extract::Json;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use once_cell::sync::Lazy;

use crate::error::AppError;

static PROXY_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        // 上游 agent 循环最长可跑数分钟;连接超时短、整体不设上限,
        // 由上游自身的轮数/超时护栏兜底。
        .connect_timeout(std::time::Duration::from_secs(3))
        .build()
        .expect("build ai proxy client")
});

fn ai_service_base() -> String {
    std::env::var("RUST_API_AI_SERVICE_BASE")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "http://127.0.0.1:41100".to_string())
}

pub async fn ask_proxy(
    headers: HeaderMap,
    Json(payload): Json<serde_json::Value>,
) -> Result<Response, AppError> {
    let api_key = headers
        .get("X-API-Key")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let upstream = PROXY_CLIENT
        .post(format!("{}/v1/ask", ai_service_base()))
        .header("X-API-Key", api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            AppError::bad_gateway(format!(
                "AI service unreachable at {}: {error}",
                ai_service_base()
            ))
        })?;

    let status = StatusCode::from_u16(upstream.status().as_u16())
        .unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = upstream
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let body = Body::from_stream(upstream.bytes_stream());
    Ok((
        status,
        [
            (axum::http::header::CONTENT_TYPE, content_type),
            (axum::http::header::CACHE_CONTROL, "no-cache".to_string()),
        ],
        body,
    )
        .into_response())
}
