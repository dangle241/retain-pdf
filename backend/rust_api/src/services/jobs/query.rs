use std::path::{Component, Path};

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::ListJobsQuery;
use crate::models::domain::{JobSnapshot, WorkflowKind};
use crate::storage_paths::{
    job_uses_legacy_output_layout, job_uses_legacy_path_storage, to_relative_data_path, JobPaths,
    LEGACY_JOB_UNSUPPORTED_MESSAGE, TRANSLATION_MANIFEST_FILE_NAME,
};

pub(super) fn load_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    db.get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))
}

fn ensure_supported_job_layout(data_root: &Path, job: &JobSnapshot) -> Result<(), AppError> {
    if job_uses_legacy_output_layout(job, data_root) || job_uses_legacy_path_storage(job) {
        return Err(AppError::conflict(LEGACY_JOB_UNSUPPORTED_MESSAGE));
    }
    Ok(())
}

pub(super) fn load_supported_job(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let mut job = load_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    recover_missing_checkpoint_artifacts(data_root, &mut job);
    Ok(job)
}

fn recover_missing_checkpoint_artifacts(data_root: &Path, job: &mut JobSnapshot) {
    let has_translations_dir = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some();
    if has_translations_dir {
        return;
    }

    let output_root = data_root.join("jobs");
    let translated_dir = JobPaths::for_job(&output_root, &job.job_id).translated_dir;
    if !translation_checkpoint_is_complete(&translated_dir) {
        return;
    }
    let Ok(relative_dir) = to_relative_data_path(data_root, &translated_dir) else {
        return;
    };
    job.artifacts
        .get_or_insert_with(Default::default)
        .translations_dir = Some(relative_dir);
}

fn translation_checkpoint_is_complete(translated_dir: &Path) -> bool {
    let manifest_path = translated_dir.join(TRANSLATION_MANIFEST_FILE_NAME);
    let Ok(raw) = std::fs::read_to_string(manifest_path) else {
        return false;
    };
    let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return false;
    };
    let Some(pages) = manifest.get("pages").and_then(serde_json::Value::as_array) else {
        return false;
    };
    if pages.is_empty() {
        return false;
    }
    let mut saw_translation_item = false;
    for page in pages {
            let Some(value) = page.get("path").and_then(serde_json::Value::as_str) else {
                return false;
            };
            let relative = Path::new(value.trim());
            let path_is_safe = !value.trim().is_empty()
                && !relative.is_absolute()
                && relative
                    .components()
                    .all(|component| matches!(component, Component::Normal(_)));
            if !path_is_safe {
                return false;
            }
            let Ok(raw_page) = std::fs::read_to_string(translated_dir.join(relative)) else {
                return false;
            };
            let Ok(page_payload) = serde_json::from_str::<serde_json::Value>(&raw_page) else {
                return false;
            };
            let Some(items) = page_payload.as_array() else {
                return false;
            };
            saw_translation_item |= !items.is_empty();
            if !items.iter().all(translation_item_is_complete) {
                return false;
            }
    }
    saw_translation_item
}

fn translation_item_is_complete(item: &serde_json::Value) -> bool {
    let Some(item) = item.as_object() else {
        return false;
    };
    let diagnostics = item
        .get("translation_diagnostics")
        .and_then(serde_json::Value::as_object);
    let final_status = diagnostics
        .and_then(|value| value.get("final_status"))
        .and_then(serde_json::Value::as_str)
        .or_else(|| item.get("final_status").and_then(serde_json::Value::as_str))
        .unwrap_or("")
        .trim();
    let has_translation = [
        "translated_text",
        "protected_translated_text",
        "translation_unit_translated_text",
        "translation_unit_protected_translated_text",
    ]
    .iter()
    .any(|key| {
        item.get(*key)
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
    });

    match final_status {
        "translated" | "partially_translated" => {
            has_translation || translation_item_may_keep_origin(item, diagnostics)
        }
        "kept_origin" => translation_item_may_keep_origin(item, diagnostics),
        _ => false,
    }
}

fn translation_item_may_keep_origin(
    item: &serde_json::Map<String, serde_json::Value>,
    diagnostics: Option<&serde_json::Map<String, serde_json::Value>>,
) -> bool {
    if item.get("should_translate").and_then(serde_json::Value::as_bool) == Some(false)
        || item.get("policy_translate").and_then(policy_bool) == Some(false)
        || item.get("block_kind").and_then(serde_json::Value::as_str) == Some("formula")
    {
        return true;
    }
    let allowed_reasons = [
        "code",
        "keep_origin",
        "no_trans",
        "short_non_body_label",
        "skip_interline_equation",
        "skip_display_formula",
        "skip_model_keep_origin",
    ];
    let has_allowed_reason = ["skip_reason", "classification_label"]
        .iter()
        .filter_map(|key| item.get(*key).and_then(serde_json::Value::as_str))
        .chain(diagnostics.into_iter().flat_map(|value| {
            ["degradation_reason", "fallback_to"]
                .into_iter()
                .filter_map(|key| value.get(key).and_then(serde_json::Value::as_str))
        }))
        .any(|value| allowed_reasons.contains(&value.trim()));
    let has_allowed_route = diagnostics
        .and_then(|value| value.get("route_path"))
        .and_then(serde_json::Value::as_array)
        .is_some_and(|routes| {
            routes.iter().any(|route| {
                route.as_str().is_some_and(|value| value.trim() == "fast_path_keep_origin")
            })
        });
    has_allowed_reason || has_allowed_route
}

fn policy_bool(value: &serde_json::Value) -> Option<bool> {
    value.as_bool().or_else(|| {
        value.as_str().and_then(|value| match value.trim().to_ascii_lowercase().as_str() {
            "true" => Some(true),
            "false" => Some(false),
            _ => None,
        })
    })
}

pub(super) fn load_ocr_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    if !matches!(job.workflow, WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    Ok(job)
}

pub(super) fn load_ocr_job_with_supported_layout(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_ocr_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub(super) fn list_jobs_filtered(
    db: &Db,
    query: &ListJobsQuery,
) -> Result<Vec<JobSnapshot>, AppError> {
    let jobs = db.list_jobs(
        query.limit,
        query.offset,
        query.status.as_ref(),
        query.workflow.as_ref(),
    )?;
    Ok(jobs
        .into_iter()
        .filter(|job| {
            query
                .provider
                .as_deref()
                .map(|provider| {
                    job.artifacts
                        .as_ref()
                        .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                        .map(|diag| {
                            format!("{:?}", diag.provider).to_ascii_lowercase()
                                == provider.to_ascii_lowercase()
                        })
                        .unwrap_or(false)
                })
                .unwrap_or(true)
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::recover_missing_checkpoint_artifacts;
    use crate::models::domain::{JobArtifacts, JobSnapshot};
    use crate::models::request::CreateJobInput;
    use std::fs;

    #[test]
    fn recovers_complete_translation_checkpoint_from_disk() {
        let root = std::env::temp_dir().join(format!("recover-translation-{}", fastrand::u64(..)));
        let translated = root.join("jobs/job-recover/translated");
        fs::create_dir_all(&translated).expect("create translated dir");
        fs::write(
            translated.join("page-001.json"),
            br#"[{"source_text":"Hello","translated_text":"Xin chao","final_status":"translated"}]"#,
        )
        .expect("write page");
        fs::write(
            translated.join("translation-manifest.json"),
            br#"{"schema":"translation_manifest_v1","pages":[{"page_number":1,"path":"page-001.json"}]}"#,
        )
        .expect("write manifest");

        let mut job = JobSnapshot::new(
            "job-recover".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.artifacts = Some(JobArtifacts {
            source_pdf: Some("jobs/job-recover/source/input.pdf".to_string()),
            ..Default::default()
        });

        recover_missing_checkpoint_artifacts(&root, &mut job);

        assert_eq!(
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.translations_dir.as_deref()),
            Some("jobs/job-recover/translated")
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_untranslated_template_checkpoint() {
        let root = std::env::temp_dir().join(format!("reject-translation-{}", fastrand::u64(..)));
        let translated = root.join("jobs/job-template/translated");
        fs::create_dir_all(&translated).expect("create translated dir");
        fs::write(
            translated.join("page-001.json"),
            br#"[{"source_text":"Hello","translated_text":"","final_status":""}]"#,
        )
        .expect("write page");
        fs::write(
            translated.join("translation-manifest.json"),
            br#"{"schema":"translation_manifest_v1","pages":[{"page_number":1,"path":"page-001.json"}]}"#,
        )
        .expect("write manifest");
        let mut job = JobSnapshot::new(
            "job-template".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.artifacts = Some(JobArtifacts::default());

        recover_missing_checkpoint_artifacts(&root, &mut job);

        assert!(job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.translations_dir.as_ref())
            .is_none());
        let _ = fs::remove_dir_all(root);
    }
}
