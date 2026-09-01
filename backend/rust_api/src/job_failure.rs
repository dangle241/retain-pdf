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
            "External model service domain resolution failed.",
            Some("Container cannot resolve upstream model service domain; translation task aborted.".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Retry once first; if persists, check. Docker DNSHost network proxy configuration".to_string()),
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
"External service request timed out",
            Some("Task invocation OCR Model service request timed out.".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Retry directly; if frequent, reduce concurrency or check network stability.".to_string()),
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
            "Python worker Execution timeout",
            Some(format!(
                "Python Subprocess terminated after exceeding runtime timeout threshold (timeout_seconds={timeout_seconds}）"
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Can resume from breakpoint or retry; if frequent, suggest reduce concurrency, increase. timeout_secondsor check upstream network latency.".to_string()),
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
            "Formula placeholder validation failed.",
            Some("Model returned formula placeholder count or order mismatch with source; translation failed protection validation.".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Retry directly. If stable reproducible, use conservative single-block translation for that block./Preserve original text strategy.".to_string()),
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
            "source PDF Missing",
            Some("OCR Completed, but cannot find source in task working directory when entering standardization phase. PDF".to_string()),
            false,
            None,
            provider_name(diagnostics),
            Some(
                "Check under the desktop task directory. source/ Does source exist? PDFand confirm packaging environment did not omit file-copy steps."
                    .to_string(),
            ),
            select_relevant_log_line(job, error, &["source pdf not found"]),
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
            "Authentication failed.",
            Some("Used by current task. API Key / Token Invalid, expired, or insufficient permissions.".to_string()),
            false,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
Some("Check MinerU Tokenmodel API Key or backend X-API-Key configuration".to_string()),
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
            "Upstream service triggers rate limiting.",
            Some("Too many requests in short time. Upstream service refuses further processing.".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Wait a while and retry, or reduce. workers / Concurrency Configuration".to_string()),
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
            "Typst Failed to download rendering dependencies.",
            Some("Required for rendering stage. Typst Failed to retrieve package, causing PDF Compilation interrupted.".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "Check if desktop package is built-in. Typst packagesor confirm the runtime environment is accessible. packages.typst.org"
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
            "Formatting or compilation stage failed.",
            Some("Translation partially complete, but in layout, rendering, or PDF Compilation interrupted".to_string()),
            false,
            None,
            provider_name(diagnostics),
Some("Check typstFont completeness check. Run `fc-list : family file | sort -u > fonts.txt`. Compare with `fonts.txt` expected list. Mismatch: missing fonts install.".to_string()),
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
            "Python worker Non-zero exit",
            Some(format!(
                "Python Child process returned non-zero exit code {}but no more specific failure category was matched",
                result.return_code
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
Some("View raw_exception_message, traceback and log_tailIf intermediate artifacts exist, try resuming from checkpoint.".to_string()),
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
        "Task failed; no clear root cause yet.",
        unknown_root_cause(error, &haystack, raw_diagnostic.as_ref()),
        true,
        extract_upstream_host(&haystack),
        provider_name(diagnostics),
Some("View log_tail Troubleshoot further with full error log.".to_string()),
        select_relevant_log_line(job, error, &[]),
        first_error_excerpt(error, &haystack),
        raw_diagnostic,
    ))
}

#[cfg(test)]
mod tests {
    use super::classify_job_failure;
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
        job.stage_detail = Some("Translating.".to_string());

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
job.stage_detail = Some("translating".to_string());
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
job.stage_detail = Some("translating".to_string());

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
        job.stage_detail = Some("Preparing to render".to_string());

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
            "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"stage\":\"normalization\",\"error_type\":\"document_schema_validation_failed\",\"summary\":\"Standardized document validation failed.\",\"detail\":\"normalized document schema validation failed\",\"retryable\":false,\"upstream_host\":\"\",\"provider\":\"ocr\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"normalized document schema validation failed\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
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
assert_eq!(failure.suggestion.as_deref(), Some("Update Token"));
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
assert_eq!(failure.summary, "source PDF missing");
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
        job.stage_detail = Some("Python worker Execution failed.".to_string());
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
