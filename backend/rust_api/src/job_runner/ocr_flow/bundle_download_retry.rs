use std::path::Path;
use std::time::Instant;

use anyhow::Result;

use crate::job_runner::ProcessRuntimeDeps;
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::mineru::MineruClient;

use super::bundle_events::{record_bundle_retry_scheduled, BundleRetryEvent};
use super::mineru_retry::should_retry_mineru_poll_error;
use super::save_ocr_job;

pub(super) async fn download_mineru_bundle_with_retry(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    full_zip_url: &str,
    dest_path: &Path,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let started = Instant::now();
    let mut attempt = 0usize;
    loop {
        match client.download_bundle(full_zip_url, dest_path).await {
            Ok(()) => return Ok(()),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err)
                    || started.elapsed().as_secs() >= timeout_secs
                    || attempt
                        >= deps
                            .config
                            .provider_runtime
                            .mineru
                            .bundle_download_retry_limit
                {
                    return Err(err);
                }
                let runtime = deps.mineru_runtime();
                let delay_secs = std::cmp::min(
                    runtime.bundle_download_base_delay_secs * attempt as u64,
                    runtime.bundle_retry_max_delay_secs,
                );
                job.append_log(&format!(
                    "MinerU download bundle retry {attempt}/{}: {full_zip_url} after error: {}",
                    runtime.bundle_download_retry_limit, err
                ));
                record_bundle_retry_scheduled(
                    deps,
                    job,
                    format!(
                        "OCR provider bundle download error, retrying in {delay_secs}s (attempt {attempt}/{})",
                        runtime.bundle_download_retry_limit
                    ),
                    "OCR provider bundle download entered retry",
                    BundleRetryEvent {
                        scope: "mineru_bundle_download",
                        attempt,
                        max_attempts: runtime.bundle_download_retry_limit,
                        delay_secs: Some(delay_secs),
                        elapsed_secs: None,
                        timeout_secs: None,
                        reason: err.to_string(),
                        url: full_zip_url,
                    },
                );
                save_ocr_job(deps, job, parent_job_id).await?;
                tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
            }
        }
    }
}
