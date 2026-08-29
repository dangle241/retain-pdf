use once_cell::sync::Lazy;
use regex::Regex;

use crate::ocr_provider::mineru::models::parse_envelope_fragment;
use crate::ocr_provider::types::{OcrErrorCategory, OcrProviderErrorInfo};

static PROVIDER_CODE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"A\d{4}|-\d{3,5}").unwrap());

fn make_error(
    category: OcrErrorCategory,
    provider_code: Option<&str>,
    provider_message: impl Into<String>,
    operator_hint: Option<&str>,
    trace_id: Option<&str>,
) -> OcrProviderErrorInfo {
    OcrProviderErrorInfo {
        category,
        provider_code: provider_code.map(str::to_string),
        provider_message: Some(provider_message.into()),
        operator_hint: operator_hint.map(str::to_string),
        trace_id: trace_id.map(str::to_string),
        http_status: None,
    }
}

pub fn extract_provider_error_code(text: &str) -> Option<String> {
    if let Some(envelope) = parse_envelope_fragment(text) {
        match envelope.code {
            serde_json::Value::String(value) => {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
            serde_json::Value::Number(value) => return Some(value.to_string()),
            _ => {}
        }
    }
    PROVIDER_CODE_RE.find(text).map(|m| m.as_str().to_string())
}

pub fn extract_provider_trace_id(text: &str) -> Option<String> {
    let envelope = parse_envelope_fragment(text)?;
    let trace = envelope.trace_id.trim();
    if trace.is_empty() {
        return None;
    }
    Some(trace.to_string())
}

pub fn extract_provider_message(text: &str) -> Option<String> {
    if let Some(envelope) = parse_envelope_fragment(text) {
        let msg = envelope.msg.trim();
        if !msg.is_empty() {
            return Some(msg.to_string());
        }
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

pub fn map_provider_error_code(
    provider_code: &str,
    provider_message: impl Into<String>,
    trace_id: Option<&str>,
) -> OcrProviderErrorInfo {
    let message = provider_message.into();
    match provider_code.trim() {
        "A0202" => make_error(
            OcrErrorCategory::Unauthorized,
            Some("A0202"),
            message,
            Some("Kiểm tra Token có chính xác không, xem có tiền tố Bearer hoặc đổi Token mới"),
            trace_id,
        ),
        "A0211" => make_error(
            OcrErrorCategory::CredentialExpired,
            Some("A0211"),
            message,
            Some("Đổi Token mới"),
            trace_id,
        ),
        "-500" => make_error(
            OcrErrorCategory::InvalidRequest,
            Some("-500"),
            message,
            Some("Đảm bảo kiểu tham số và Content-Type chính xác"),
            trace_id,
        ),
        "-10001" => make_error(
            OcrErrorCategory::ServiceUnavailable,
            Some("-10001"),
            message,
            Some("Vui lòng thử lại sau"),
            trace_id,
        ),
        "-10002" => make_error(
            OcrErrorCategory::InvalidRequest,
            Some("-10002"),
            message,
            Some("Kiểm tra định dạng tham số yêu cầu"),
            trace_id,
        ),
        "-60001" => make_error(
            OcrErrorCategory::UploadLinkRequestFailed,
            Some("-60001"),
            message,
            Some("Vui lòng thử lại sau"),
            trace_id,
        ),
        "-60002" => make_error(
            OcrErrorCategory::UnsupportedFileFormat,
            Some("-60002"),
            message,
            Some("Phát hiện loại tệp thất bại, yêu cầu tên tệp và liên kết có đuôi đúng, tệp thuộc pdf,doc,docx,ppt,pptx,png,jp(e)g"),
            trace_id,
        ),
        "-60003" => make_error(
            OcrErrorCategory::FileReadFailed,
            Some("-60003"),
            message,
            Some("Vui lòng kiểm tra tệp có hỏng không và tải lên lại"),
            trace_id,
        ),
        "-60004" => make_error(
            OcrErrorCategory::EmptyFile,
            Some("-60004"),
            message,
            Some("Vui lòng tải lên tệp hợp lệ"),
            trace_id,
        ),
        "-60005" => make_error(
            OcrErrorCategory::FileTooLarge,
            Some("-60005"),
            message,
            Some("Kiểm tra kích thước tệp, tối đa hỗ trợ 200MB"),
            trace_id,
        ),
        "-60006" => make_error(
            OcrErrorCategory::TooManyPages,
            Some("-60006"),
            message,
            Some("Vui lòng chia nhỏ tệp và thử lại"),
            trace_id,
        ),
        "-60007" => make_error(
            OcrErrorCategory::ServiceUnavailable,
            Some("-60007"),
            message,
            Some("Vui lòng thử lại sau hoặc liên hệ hỗ trợ kỹ thuật"),
            trace_id,
        ),
        "-60008" => make_error(
            OcrErrorCategory::RemoteReadTimeout,
            Some("-60008"),
            message,
            Some("Kiểm tra URL có thể truy cập"),
            trace_id,
        ),
        "-60009" => make_error(
            OcrErrorCategory::QueueFull,
            Some("-60009"),
            message,
            Some("Vui lòng thử lại sau"),
            trace_id,
        ),
        "-60010" => make_error(
            OcrErrorCategory::ParseFailed,
            Some("-60010"),
            message,
            Some("Vui lòng thử lại sau"),
            trace_id,
        ),
        "-60011" => make_error(
            OcrErrorCategory::UploadedFileMissing,
            Some("-60011"),
            message,
            Some("Đảm bảo tệp đã được tải lên"),
            trace_id,
        ),
        "-60012" => make_error(
            OcrErrorCategory::TaskNotFound,
            Some("-60012"),
            message,
            Some("Đảm bảo task_id hợp lệ và chưa bị xóa"),
            trace_id,
        ),
        "-60013" => make_error(
            OcrErrorCategory::PermissionDenied,
            Some("-60013"),
            message,
            Some("Chỉ có thể truy cập tác vụ do mình gửi"),
            trace_id,
        ),
        "-60014" => make_error(
            OcrErrorCategory::OperationNotAllowed,
            Some("-60014"),
            message,
            Some("Tác vụ đang chạy hiện chưa hỗ trợ xóa"),
            trace_id,
        ),
        "-60015" => make_error(
            OcrErrorCategory::ConversionFailed,
            Some("-60015"),
            message,
            Some("Có thể chuyển sang pdf thủ công rồi tải lên"),
            trace_id,
        ),
        "-60016" => make_error(
            OcrErrorCategory::ConversionFailed,
            Some("-60016"),
            message,
            Some("Chuyển đổi tệp sang định dạng yêu cầu thất bại, có thể thử xuất định dạng khác hoặc thử lại"),
            trace_id,
        ),
        "-60017" => make_error(
            OcrErrorCategory::RetryLimitReached,
            Some("-60017"),
            message,
            Some("Thử lại sau khi nâng cấp mô hình"),
            trace_id,
        ),
        "-60018" => make_error(
            OcrErrorCategory::QuotaExceeded,
            Some("-60018"),
            message,
            Some("Hãy quay lại vào ngày mai"),
            trace_id,
        ),
        "-60019" => make_error(
            OcrErrorCategory::HtmlQuotaExceeded,
            Some("-60019"),
            message,
            Some("Hãy quay lại vào ngày mai"),
            trace_id,
        ),
        "-60020" => make_error(
            OcrErrorCategory::FileSplitFailed,
            Some("-60020"),
            message,
            Some("Vui lòng thử lại sau"),
            trace_id,
        ),
        "-60021" => make_error(
            OcrErrorCategory::PageCountReadFailed,
            Some("-60021"),
            message,
            Some("Vui lòng thử lại sau"),
            trace_id,
        ),
        "-60022" => make_error(
            OcrErrorCategory::WebReadFailed,
            Some("-60022"),
            message,
            Some("Có thể do vấn đề mạng hoặc giới hạn tần số dẫn đến lỗi đọc, vui lòng thử lại sau"),
            trace_id,
        ),
        other => make_error(
            OcrErrorCategory::Unknown,
            Some(other),
            message,
            None,
            trace_id,
        ),
    }
}

pub fn classify_runtime_failure(message: &str, trace_id: Option<&str>) -> OcrProviderErrorInfo {
    let provider_message = extract_provider_message(message).unwrap_or_else(|| message.to_string());
    let resolved_trace_id = trace_id
        .map(str::to_string)
        .or_else(|| extract_provider_trace_id(message))
        .unwrap_or_default();
    let trace_ref = if resolved_trace_id.is_empty() {
        None
    } else {
        Some(resolved_trace_id.as_str())
    };

    if let Some(code) = extract_provider_error_code(message) {
        return map_provider_error_code(&code, provider_message, trace_ref);
    }
    let lowered = message.to_ascii_lowercase();
    if lowered.contains("timed out") || lowered.contains("timeout") {
        return make_error(
            OcrErrorCategory::PollTimeout,
            None,
            provider_message,
            Some("Vui lòng kiểm tra tác vụ MinerU có bị kẹt lâu không, hoặc tăng thời gian chờ lần lượt phù hợp"),
            trace_ref,
        );
    }
    if lowered.contains("upload") {
        return make_error(
            OcrErrorCategory::UploadFailed,
            None,
            provider_message,
            Some("Vui lòng kiểm tra liên kết tải lên có hợp lệ không, hoặc yêu cầu lại URL tải lên rồi thử"),
            trace_ref,
        );
    }
    if lowered.contains("full_zip_url") || lowered.contains("missing field") {
        return make_error(
            OcrErrorCategory::InvalidProviderResponse,
            None,
            provider_message,
            Some("Vui lòng kiểm tra cấu trúc trả về của provider có đầy đủ, chủ yếu xác nhận các trường khóa như full_zip_url"),
            trace_ref,
        );
    }
    make_error(
        OcrErrorCategory::ProviderFailed,
        None,
        provider_message,
        Some("Vui lòng kết hợp message gốc provider, trace_id và trạng thái tác vụ để tiếp tục xử lý sự cố"),
        trace_ref,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ocr_provider::types::OcrErrorCategory;

    #[test]
    fn maps_readme_codes_60004_to_60022() {
        let cases = [
            ("-60004", OcrErrorCategory::EmptyFile, "Vui lòng tải lên tệp hợp lệ"),
            (
                "-60005",
                OcrErrorCategory::FileTooLarge,
                "Kiểm tra kích thước tệp, tối đa hỗ trợ 200MB",
            ),
            ("-60006", OcrErrorCategory::TooManyPages, "Vui lòng chia nhỏ tệp và thử lại"),
            (
                "-60007",
                OcrErrorCategory::ServiceUnavailable,
                "Vui lòng thử lại sau hoặc liên hệ hỗ trợ kỹ thuật",
            ),
            (
                "-60008",
                OcrErrorCategory::RemoteReadTimeout,
                "Kiểm tra URL có thể truy cập",
            ),
            ("-60009", OcrErrorCategory::QueueFull, "Vui lòng thử lại sau"),
            ("-60010", OcrErrorCategory::ParseFailed, "Vui lòng thử lại sau"),
            (
                "-60011",
                OcrErrorCategory::UploadedFileMissing,
                "Đảm bảo tệp đã được tải lên",
            ),
            (
                "-60012",
                OcrErrorCategory::TaskNotFound,
                "Đảm bảo task_id hợp lệ và chưa bị xóa",
            ),
            (
                "-60013",
                OcrErrorCategory::PermissionDenied,
                "Chỉ có thể truy cập tác vụ do mình gửi",
            ),
            (
                "-60014",
                OcrErrorCategory::OperationNotAllowed,
                "Tác vụ đang chạy hiện chưa hỗ trợ xóa",
            ),
            (
                "-60015",
                OcrErrorCategory::ConversionFailed,
                "Có thể chuyển sang pdf thủ công rồi tải lên",
            ),
            (
                "-60016",
                OcrErrorCategory::ConversionFailed,
                "Chuyển đổi tệp sang định dạng yêu cầu thất bại, có thể thử xuất định dạng khác hoặc thử lại",
            ),
            (
                "-60017",
                OcrErrorCategory::RetryLimitReached,
                "Thử lại sau khi nâng cấp mô hình",
            ),
            ("-60018", OcrErrorCategory::QuotaExceeded, "Hãy quay lại vào ngày mai"),
            ("-60019", OcrErrorCategory::HtmlQuotaExceeded, "Hãy quay lại vào ngày mai"),
            ("-60020", OcrErrorCategory::FileSplitFailed, "Vui lòng thử lại sau"),
            (
                "-60021",
                OcrErrorCategory::PageCountReadFailed,
                "Vui lòng thử lại sau",
            ),
            (
                "-60022",
                OcrErrorCategory::WebReadFailed,
                "Có thể do vấn đề mạng hoặc giới hạn tần số dẫn đến lỗi đọc, vui lòng thử lại sau",
            ),
        ];
        for (code, category, hint) in cases {
            let mapped = map_provider_error_code(code, "provider says no", Some("trace-1"));
            assert_eq!(mapped.provider_code.as_deref(), Some(code));
            assert_eq!(mapped.category, category, "code={code}");
            assert_eq!(mapped.operator_hint.as_deref(), Some(hint), "code={code}");
            assert_eq!(mapped.trace_id.as_deref(), Some("trace-1"));
            assert_eq!(mapped.provider_message.as_deref(), Some("provider says no"));
        }
    }

    #[test]
    fn extracts_and_maps_code_from_runtime_message() {
        let mapped =
            classify_runtime_failure("MinerU API error -60011: missing upload object", None);
        assert_eq!(mapped.category, OcrErrorCategory::UploadedFileMissing);
        assert_eq!(mapped.provider_code.as_deref(), Some("-60011"));
    }

    #[test]
    fn extracts_trace_and_message_from_embedded_json() {
        let text = r#"requests failed: {"code":-60011,"msg":"Không thể lấy tệp hợp lệ","trace_id":"trace-xyz","data":null}"#;
        let mapped = classify_runtime_failure(text, None);
        assert_eq!(mapped.provider_code.as_deref(), Some("-60011"));
        assert_eq!(mapped.provider_message.as_deref(), Some("Không thể lấy tệp hợp lệ"));
        assert_eq!(mapped.trace_id.as_deref(), Some("trace-xyz"));
        assert_eq!(mapped.operator_hint.as_deref(), Some("Đảm bảo tệp đã được tải lên"));
    }
}
