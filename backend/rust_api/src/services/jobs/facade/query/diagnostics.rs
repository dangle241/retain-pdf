use crate::error::AppError;
use crate::job_failure::resolve_job_failure;
use crate::models::api::{JobDiagnosticsView, JobResumePlanView};
use crate::models::domain::{JobFailureInfo, JobSnapshot, JobStatusKind};
use crate::services::jobs::stage_plan::resume_plan;
use crate::storage_paths::resolve_pipeline_summary;

use super::super::super::query::load_supported_job;
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn job_diagnostics_view(&self, job_id: &str) -> Result<JobDiagnosticsView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        Ok(build_job_diagnostics_view(&job, self.query.data_root))
    }

    pub fn resume_plan_view(&self, job_id: &str) -> Result<JobResumePlanView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        Ok(build_resume_plan_view(&job))
    }
}

fn build_job_diagnostics_view(
    job: &JobSnapshot,
    data_root: &std::path::Path,
) -> JobDiagnosticsView {
    let failure = resolved_failure(job);
    let resume_plan = build_resume_plan_view(job);
    let render_diagnostics = load_render_diagnostics(job, data_root);
    match failure {
        Some(failure) => JobDiagnosticsView {
            failed_stage: Some(failure.failed_stage_value().to_string()),
            failed_substage: failure.provider_stage.clone(),
            summary: failure.summary.clone(),
            detail: failure
                .root_cause
                .clone()
                .or_else(|| failure.raw_excerpt.clone())
                .or_else(|| failure.raw_error_excerpt.clone())
                .or_else(|| failure.last_log_line.clone()),
            suggestion: failure.suggestion.clone(),
            retryable: failure.retryable,
            resume_available: resume_plan.can_resume,
            render_diagnostics,
        },
        None => JobDiagnosticsView {
            failed_stage: job.stage.clone(),
            failed_substage: None,
            summary: if matches!(job.status, JobStatusKind::Failed) {
                job.error
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| {
                        "Tác vụ thất bại nhưng chưa xác định được nguyên nhân".to_string()
                    })
            } else {
                "Tác vụ hiện không có chẩn đoán lỗi".to_string()
            },
            detail: job.error.clone(),
            suggestion: None,
            retryable: false,
            resume_available: resume_plan.can_resume,
            render_diagnostics,
        },
    }
}

fn load_render_diagnostics(
    job: &JobSnapshot,
    data_root: &std::path::Path,
) -> Option<serde_json::Value> {
    let path = resolve_pipeline_summary(job, data_root)?;
    let data = std::fs::read_to_string(path).ok()?;
    let summary: serde_json::Value = serde_json::from_str(&data).ok()?;
    let diagnostics = summary.get("render_diagnostics")?;
    if diagnostics.is_null() {
        return None;
    }
    Some(diagnostics.clone())
}

fn build_resume_plan_view(job: &JobSnapshot) -> JobResumePlanView {
    let plan = resume_plan(job);
    JobResumePlanView {
        can_resume: plan.can_resume,
        job_id: job.job_id.clone(),
        from_stage: plan.from_stage,
        resume_workflow: plan.resume_workflow,
        reuses_artifacts: plan.reuses_artifacts,
        reruns_stages: plan.reruns_stages,
        reason: plan.reason,
    }
}

fn resolved_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    resolve_job_failure(job).map(localize_legacy_failure)
}

fn localize_legacy_failure(mut failure: JobFailureInfo) -> JobFailureInfo {
    let failure_code = failure
        .failure_code
        .as_deref()
        .unwrap_or(failure.category.as_str());
    if failure_code == "upstream_timeout"
        && [
            failure.summary.as_str(),
            failure.root_cause.as_deref().unwrap_or_default(),
            failure.suggestion.as_deref().unwrap_or_default(),
        ]
        .iter()
        .any(|value| contains_han(value))
    {
        failure.summary = "Yêu cầu tới dịch vụ bên ngoài bị hết thời gian chờ".to_string();
        failure.root_cause = Some(
            "Dịch vụ OCR hoặc mô hình phản hồi quá chậm và vượt quá thời gian chờ".to_string(),
        );
        failure.suggestion = Some(
            "Có thể thử lại ngay; nếu lỗi thường xuyên, hãy giảm số luồng hoặc kiểm tra đường truyền"
                .to_string(),
        );
    }
    failure
}

fn contains_han(value: &str) -> bool {
    value
        .chars()
        .any(|character| ('\u{4e00}'..='\u{9fff}').contains(&character))
}
