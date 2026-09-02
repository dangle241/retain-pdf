//! Reverse proxy in front of the retainpdf-ai service.
//!
//! The frontend keeps a single entry point (the Rust API) and a single
//! `X-API-Key`: this route forwards requests to the long-lived AI
//! service and passes the client's `X-API-Key` through (the two services
//! share the same key set, so the frontend needs zero new config). SSE
//! streaming responses are proxied byte-for-byte.

use axum::body::Body;
use axum::extract::Json;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use once_cell::sync::Lazy;

use crate::error::AppError;

static PROXY_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        // The upstream agent loop can run for several minutes; we use a
        // short connect timeout and no overall request cap, relying on
        // the upstream's own turn-count / timeout guards.
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
