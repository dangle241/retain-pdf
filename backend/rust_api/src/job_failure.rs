#[path = "job_failure_structured.rs"]
mod job_failure_structured;
#[path = "job_failure_support.rs"]
mod job_failure_support;

use crate::models::domain::{JobFailureInfo, JobSnapshot, JobStatusKind};

use self::job_failure_structured::{
    classify_provider_auth_failure, classify_structured_failure, extract_structured_failure,
    PythonStructuredFailure,
};
use self::job_failure_support::{
    build_failure, contains_render_failure_signal, extract_upstream_host, first_error_excerpt,
    infer_failed_stage, provider_name, raw_diagnostic_from_process_result,
    raw_diagnostic_from_structured, raw_diagnostic_from_text, select_relevant_log_line,
    unknown_root_cause,
};

pub const STRUCTURED_FAILURE_LABEL: &str = "structured failure json";

pub fn classify_job_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    if !matches!(job.status, JobStatusKind::Failed) {
        return None;
    }

    let error = job.error.as_deref().unwrap_or("").trim();
    let haystack = if error.is_empty() {
        job.log_tail.join("\n")
    } else {
        format!("{error}\n{}", job.log_tail.join("\n"))
    };
    let diagnostics = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref());
    let failed_stage = infer_failed_stage(job, &haystack);
    let structured = extract_structured_failure(STRUCTURED_FAILURE_LABEL, &haystack);
    let raw_diagnostic = structured
        .as_ref()
        .map(raw_diagnostic_from_structured)
        .or_else(|| raw_diagnostic_from_text(error, &haystack));

    if let Some(structured_failure) = classify_structured_failure(
        structured.as_ref(),
        diagnostics,
        &failed_stage,
        job,
        error,
        &haystack,
    ) {
        return Some(structured_failure);
    }

    if let Some(provider_failure) = classify_provider_auth_failure(
        failed_stage.clone(),
        diagnostics,
        &haystack,
        select_relevant_log_line(
            job,
            error,
            &["401", "403", "Unauthorized", "missing or invalid X-API-Key"],
        ),
        error,
    ) {
        return Some(provider_failure);
    }

    if haystack.contains("Failed to resolve")
        || haystack.contains("NameResolutionError")
        || haystack.contains("Temporary failure in name resolution")
        || haystack.contains("socket.gaierror")
    {
        return Some(build_failure(
            failed_stage,
            "dns_resolution_failed",
            None,
            "Không phân giải được tên miền của dịch vụ bên ngoài",
            Some("Container không thể phân giải tên miền dịch vụ tại thời điểm chạy".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "Hãy thử lại; nếu lỗi tiếp diễn, kiểm tra DNS Docker, mạng máy chủ và proxy"
                    .to_string(),
            ),
            select_relevant_log_line(
                job,
                error,
                &[
                    "Temporary failure in name resolution",
                    "NameResolutionError",
                    "Failed to resolve",
                    "socket.gaierror",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("ReadTimeout")
        || haystack.contains("ConnectTimeout")
        || haystack.contains("timed out")
    {
        return Some(build_failure(
            failed_stage,
            "upstream_timeout",
            None,
            "Yêu cầu tới dịch vụ bên ngoài bị hết thời gian chờ",
            Some("Dịch vụ OCR hoặc mô hình phản hồi quá chậm và vượt quá thời gian chờ".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Có thể thử lại ngay; nếu lỗi thường xuyên, hãy giảm số luồng hoặc kiểm tra đường truyền".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "ReadTimeout",
                    "ConnectTimeout",
                    "timed out",
                    "api.deepseek.com",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if job
        .result
        .as_ref()
        .is_some_and(|result| !result.success && result.return_code == -1)
    {
        let timeout_seconds = job.request_payload.runtime.timeout_seconds;
        return Some(build_failure(
            failed_stage,
            "process_timeout",
            Some("timeout".to_string()),
            "Tiến trình Python hết thời gian chạy",
            Some(format!(
                "Tiến trình Python bị dừng vì vượt quá timeout_seconds={timeout_seconds}"
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Hãy tiếp tục từ điểm dừng hoặc thử lại; nếu lỗi lặp lại, giảm số luồng, tăng timeout_seconds hoặc kiểm tra mạng".to_string()),
            select_relevant_log_line(job, error, &["timeout", "timed out", "stderr before timeout"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic_from_process_result(job)
                .or_else(|| raw_diagnostic.clone()),
        ));
    }

    if haystack.contains("PlaceholderInventoryError")
        || haystack.contains("UnexpectedPlaceholderError")
        || haystack.contains("placeholder inventory mismatch")
        || haystack.contains("unexpected placeholders in translation")
        || haystack.contains("placeholder instability")
        || haystack.contains("degraded to keep_origin after repeated placeholder instability")
    {
        return Some(build_failure(
            failed_stage,
            "placeholder_unstable",
            None,
            "Kiểm tra placeholder công thức thất bại",
            Some("Số lượng hoặc thứ tự placeholder công thức do mô hình trả về không khớp bản gốc".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Có thể thử lại; nếu lỗi lặp lại ở cùng đoạn, hãy giữ nguyên đoạn đó hoặc dịch từng đoạn".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "PlaceholderInventoryError",
                    "UnexpectedPlaceholderError",
                    "placeholder inventory mismatch",
                    "unexpected placeholders in translation",
                    "placeholder instability",
                    "degraded to keep_origin after repeated placeholder instability",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("source pdf not found") {
        return Some(build_failure(
            "normalization".to_string(),
            "source_pdf_missing",
            None,
            "Thiếu PDF nguồn",
            Some("OCR đã hoàn tất nhưng không tìm thấy PDF nguồn khi bắt đầu chuẩn hóa".to_string()),
            false,
            None,
            provider_name(diagnostics),
            Some(
                "Kiểm tra PDF trong thư mục source/ của tác vụ và bước sao chép file trong bản đóng gói"
                    .to_string(),
            ),
            select_relevant_log_line(job, error, &["source pdf not found"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("insufficient_quota")
        || haystack.contains("exceeded your current quota")
        || haystack.contains("check your plan and billing details")
        || haystack.contains("quota_exhausted")
    {
        return Some(build_failure(
            failed_stage,
            "quota_exhausted",
            None,
            "Đã hết hạn mức API của dịch vụ dịch",
            Some("Tài khoản API đã hết quota hoặc chưa bật thanh toán cho API".to_string()),
            false,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "Kiểm tra trang Billing/Usage, nạp thêm credit hoặc dùng API key còn quota"
                    .to_string(),
            ),
            select_relevant_log_line(
                job,
                error,
                &[
                    "insufficient_quota",
                    "exceeded your current quota",
                    "check your plan and billing details",
                    "quota_exhausted",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("401")
        || haystack.contains("403")
        || haystack.contains("missing or invalid X-API-Key")
        || haystack.contains("Unauthorized")
    {
        return Some(build_failure(
            failed_stage,
            "auth_failed",
            None,
            "Xác thực thất bại",
            Some("API key hoặc token không hợp lệ, đã hết hạn hoặc không đủ quyền".to_string()),
            false,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "Kiểm tra token OCR, API key của mô hình và cấu hình X-API-Key của backend"
                    .to_string(),
            ),
            select_relevant_log_line(
                job,
                error,
                &["401", "403", "Unauthorized", "missing or invalid X-API-Key"],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("429")
        || haystack.contains("rate limit")
        || haystack.contains("Too Many Requests")
    {
        return Some(build_failure(
            failed_stage,
            "rate_limited",
            None,
            "Dịch vụ bên ngoài đang giới hạn tần suất",
            Some("Có quá nhiều yêu cầu trong thời gian ngắn nên dịch vụ từ chối xử lý".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Chờ một lúc rồi thử lại hoặc giảm workers và số yêu cầu đồng thời".to_string()),
            select_relevant_log_line(job, error, &["429", "rate limit", "Too Many Requests"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("packages.typst.org")
        || haystack.contains("failed to download package")
        || haystack.contains("downloading @preview/")
    {
        return Some(build_failure(
            "render".to_string(),
            "typst_dependency_download_failed",
            None,
            "Không tải được gói phụ thuộc Typst",
            Some(
                "Không lấy được gói Typst cần thiết nên quá trình biên dịch PDF bị dừng"
                    .to_string(),
            ),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "Kiểm tra gói Typst được đóng kèm hoặc quyền truy cập packages.typst.org"
                    .to_string(),
            ),
            select_relevant_log_line(
                job,
                error,
                &[
                    "failed to download package",
                    "packages.typst.org",
                    "downloading @preview/",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if contains_render_failure_signal(&haystack) {
        return Some(build_failure(
            failed_stage,
            "render_failed",
            None,
            "Dàn trang hoặc biên dịch thất bại",
            Some(
                "Bản dịch đã hoàn thành một phần nhưng bị dừng khi dàn trang hoặc biên dịch PDF"
                    .to_string(),
            ),
            false,
            None,
            provider_name(diagnostics),
            Some("Kiểm tra Typst, phông chữ, công thức và các artifact trung gian".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "typst compile",
                    "failed to compile",
                    "compile error",
                    "render failed",
                    "rendering failed",
                    "failed to render",
                    "typst error",
                    "font not found",
                    "missing bundled font",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if let Some(result) = job.result.as_ref().filter(|result| !result.success) {
        return Some(build_failure(
            failed_stage,
            "process_exit_failed",
            Some(format!("exit_code_{}", result.return_code)),
            "Tiến trình Python kết thúc với mã lỗi",
            Some(format!(
                "Tiến trình Python trả về mã lỗi {} nhưng chưa khớp với nhóm lỗi cụ thể",
                result.return_code
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Xem raw_exception_message, traceback và log_tail; nếu có artifact trung gian, hãy tiếp tục từ điểm dừng".to_string()),
            select_relevant_log_line(job, error, &[]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic_from_process_result(job)
                .or_else(|| raw_diagnostic.clone()),
        ));
    }

    Some(build_failure(
        failed_stage,
        "unknown",
        diagnostics
            .and_then(|diag| diag.last_error.as_ref())
            .and_then(|err| err.provider_code.clone()),
        "Tác vụ thất bại nhưng chưa xác định được nguyên nhân",
        unknown_root_cause(error, &haystack, raw_diagnostic.as_ref()),
        true,
        extract_upstream_host(&haystack),
        provider_name(diagnostics),
        Some("Xem log_tail và log lỗi đầy đủ để phân tích thêm".to_string()),
        select_relevant_log_line(job, error, &[]),
        first_error_excerpt(error, &haystack),
        raw_diagnostic,
    ))
}

pub fn resolve_job_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    let classified = classify_job_failure(job).map(JobFailureInfo::with_formal_fields);
    let has_structured_failure = classified
        .as_ref()
        .and_then(|failure| failure.raw_diagnostic.as_ref())
        .and_then(|diagnostic| diagnostic.structured_error_type.as_deref())
        .is_some_and(|value| !value.trim().is_empty());

    if has_structured_failure {
        return classified;
    }

    job.failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or(classified)
}

#[cfg(test)]
mod tests {
    use super::{classify_job_failure, resolve_job_failure};
    use crate::models::domain::{JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;

    #[test]
    fn classify_job_failure_maps_placeholder_instability() {
        let mut job = JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some("PlaceholderInventoryError: placeholder inventory mismatch".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("正在翻译".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "placeholder_unstable");
        assert_eq!(failure.stage, "translation");
    }

    #[test]
    fn classify_job_failure_does_not_treat_render_mode_log_as_render_failure() {
        let mut job = JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some("PlaceholderInventoryError: placeholder inventory mismatch".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("正在翻译".to_string());
        job.log_tail = vec![
            "auto render mode selected: overlay (removable_items=18, checked_items=18, removable_ratio=1.00)"
                .to_string(),
        ];

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "placeholder_unstable");
        assert_eq!(failure.stage, "translation");
    }

    #[test]
    fn classify_job_failure_maps_typst_compile_error_to_render_stage() {
        let mut job = JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some("typst compile failed: font not found".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("正在翻译".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "render_failed");
        assert_eq!(failure.stage, "render");
    }

    #[test]
    fn classify_job_failure_maps_typst_package_download_failure() {
        let mut job = JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some(
            "RuntimeError: downloading @preview/cmarker:0.1.8\nerror: failed to download package (https://packages.typst.org/preview/cmarker-0.1.8.tar.gz: Connection Failed)"
                .to_string(),
        );
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some("正在准备渲染".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "typst_dependency_download_failed");
        assert_eq!(failure.stage, "render");
        assert_eq!(failure.upstream_host.as_deref(), Some("packages.typst.org"));
    }

    #[test]
    fn classify_job_failure_prefers_structured_python_failure() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.error = Some(
            "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"stage\":\"normalization\",\"error_type\":\"document_schema_validation_failed\",\"summary\":\"标准化文档校验失败\",\"detail\":\"normalized document schema validation failed\",\"retryable\":false,\"upstream_host\":\"\",\"provider\":\"ocr\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"normalized document schema validation failed\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
                .to_string(),
        );

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "document_schema_validation_failed");
        assert_eq!(failure.stage, "normalization");
        assert_eq!(failure.failed_stage.as_deref(), Some("normalization"));
        assert_eq!(
            failure.failure_code.as_deref(),
            Some("document_schema_validation_failed")
        );
        assert_eq!(failure.failure_category.as_deref(), Some("normalization"));
        assert_eq!(
            failure
                .raw_diagnostic
                .as_ref()
                .and_then(|item| item.structured_error_type.as_deref()),
            Some("document_schema_validation_failed")
        );
    }

    #[test]
    fn classify_job_failure_accepts_new_structured_failure_protocol() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure-new-structured".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.error = Some(
            "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"failed_stage\":\"ocr_processing\",\"failure_code\":\"auth_failed\",\"failure_category\":\"auth\",\"summary\":\"鉴权失败\",\"root_cause\":\"MinerU token expired\",\"retryable\":false,\"upstream_host\":\"mineru.net\",\"provider\":\"mineru\",\"provider_stage\":\"mineru_processing\",\"provider_code\":\"A0211\",\"suggestion\":\"更新 Token\",\"raw_excerpt\":\"token expired\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"token expired\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
                .to_string(),
        );

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.stage, "ocr_processing");
        assert_eq!(failure.category, "auth_failed");
        assert_eq!(failure.code.as_deref(), Some("A0211"));
        assert_eq!(failure.failed_stage.as_deref(), Some("ocr_processing"));
        assert_eq!(failure.failure_code.as_deref(), Some("auth_failed"));
        assert_eq!(failure.failure_category.as_deref(), Some("auth"));
        assert_eq!(failure.provider_stage.as_deref(), Some("mineru_processing"));
        assert_eq!(failure.provider_code.as_deref(), Some("A0211"));
        assert_eq!(failure.raw_excerpt.as_deref(), Some("token expired"));
        assert_eq!(failure.raw_error_excerpt.as_deref(), Some("token expired"));
        assert_eq!(failure.suggestion.as_deref(), Some("更新 Token"));
    }

    #[test]
    fn classify_job_failure_preserves_structured_quota_failure() {
        let mut job = crate::models::JobSnapshot::new(
            "job-quota-structured".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        let mut stale_job = job.clone();
        stale_job.error = Some("401 Unauthorized".to_string());
        job.failure = classify_job_failure(&stale_job);
        job.error = Some(
            "429 Client Error: Too Many Requests\nstructured failure json: {\"failed_stage\":\"translation\",\"failure_code\":\"quota_exhausted\",\"failure_category\":\"billing\",\"stage\":\"translation\",\"error_type\":\"quota_exhausted\",\"summary\":\"API quota exhausted\",\"detail\":\"You exceeded your current quota\",\"retryable\":false,\"upstream_host\":\"api.openai.com\",\"provider\":\"openai\",\"provider_stage\":\"translation\",\"provider_code\":\"insufficient_quota\",\"suggestion\":\"Check plan and billing details\",\"raw_excerpt\":\"429 insufficient_quota\"}"
                .to_string(),
        );

        let failure = resolve_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "quota_exhausted");
        assert_eq!(failure.failure_code.as_deref(), Some("quota_exhausted"));
        assert_eq!(failure.failure_category.as_deref(), Some("billing"));
        assert_eq!(failure.provider_code.as_deref(), Some("insufficient_quota"));
        assert!(!failure.retryable);
    }

    #[test]
    fn classify_job_failure_maps_unstructured_insufficient_quota_before_rate_limit() {
        let mut job = crate::models::JobSnapshot::new(
            "job-quota-unstructured".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("translation".to_string());
        job.error = Some(
            "429 Too Many Requests: insufficient_quota: You exceeded your current quota; check your plan and billing details"
                .to_string(),
        );

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "quota_exhausted");
        assert_eq!(failure.failure_category.as_deref(), Some("billing"));
        assert!(!failure.retryable);
    }

    #[test]
    fn classify_job_failure_maps_missing_source_pdf() {
        let mut job = crate::models::JobSnapshot::new(
            "job-missing-source-pdf".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.error =
            Some("RuntimeError: source pdf not found: /tmp/jobs/job/source/input.pdf".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "source_pdf_missing");
        assert_eq!(failure.stage, "normalization");
        assert_eq!(failure.summary, "Thiếu PDF nguồn");
        assert!(!failure.retryable);
    }

    #[test]
    fn classify_job_failure_maps_unknown_process_exit() {
        let mut job = crate::models::JobSnapshot::new(
            "job-process-exit".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.stage_detail = Some("Python worker 执行失败".to_string());
        job.error = Some("plain worker failure".to_string());
        job.result = Some(crate::models::ProcessResult {
            success: false,
            return_code: 17,
            duration_seconds: 0.5,
            command: vec!["python".to_string()],
            cwd: "/tmp".to_string(),
            stdout: "".to_string(),
            stderr: "CustomWorkerError: bad state".to_string(),
        });

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "process_exit_failed");
        assert_eq!(failure.failure_code.as_deref(), Some("process_exit_failed"));
        assert_eq!(failure.failure_category.as_deref(), Some("internal"));
        assert_eq!(failure.provider_code.as_deref(), Some("exit_code_17"));
        assert_eq!(
            failure
                .raw_diagnostic
                .as_ref()
                .and_then(|item| item.raw_exception_type.as_deref()),
            Some("CustomWorkerError")
        );
    }
}
