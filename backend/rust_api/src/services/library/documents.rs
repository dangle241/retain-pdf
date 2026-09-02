//! Document CRUD and projection helpers.

use std::path::PathBuf;

use crate::error::AppError;
use crate::models::api::{
    DocumentDeleteResultView, DocumentListView, DocumentRecord, ListDocumentsQuery,
    PatchDocumentInput,
};
use crate::models::domain::UploadRecord;

use super::books::{ensure_deletable, remove_job_files, remove_path_if_exists};
use super::LibraryDeps;

pub(crate) fn document_media_urls(
    base_url: &str,
    document_id: &str,
) -> (String, String, String) {
    let base = format!(
        "{}/api/v1/documents/{}",
        base_url.trim_end_matches('/'),
        document_id
    );
    (
        format!("{base}/source.pdf"),
        format!("{base}/cover"),
        format!("{base}/thumbnail"),
    )
}

pub(crate) fn with_document_media_urls(
    mut document: DocumentRecord,
    base_url: &str,
) -> DocumentRecord {
    let (source_pdf_url, cover_url, thumbnail_url) =
        document_media_urls(base_url, &document.document_id);
    document.source_pdf_url = source_pdf_url;
    document.cover_url = cover_url;
    document.thumbnail_url = thumbnail_url;
    document
}

/// Resolve document + its stored upload, ensuring the source PDF exists on disk.
pub(crate) fn require_document_upload(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<(DocumentRecord, UploadRecord), AppError> {
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    let upload = deps
        .db
        .find_upload_for_document(document_id)?
        .ok_or_else(|| {
            AppError::not_found(format!(
                "no upload found for document: {document_id}; re-upload the PDF first"
            ))
        })?;
    let path = PathBuf::from(&upload.stored_path);
    if !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "source pdf missing on disk for document: {document_id}"
        )));
    }
    Ok((document, upload))
}

pub fn list_documents(
    deps: &LibraryDeps<'_>,
    query: &ListDocumentsQuery,
    base_url: &str,
) -> Result<DocumentListView, AppError> {
    if let Some(job_id) = query
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
    {
        let documents = deps
            .db
            .get_document_by_job_id(job_id)?
            .into_iter()
            .map(|doc| with_document_media_urls(doc, base_url))
            .collect();
        return Ok(DocumentListView { documents });
    }
    let documents = deps
        .db
        .list_documents(
            query.limit.clamp(1, 500),
            query.offset,
            query.reading_status.as_deref(),
            query.tag.as_deref(),
            query.collection_id.as_deref(),
        )?
        .into_iter()
        .map(|doc| with_document_media_urls(doc, base_url))
        .collect();
    Ok(DocumentListView { documents })
}

pub fn get_document(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    Ok(with_document_media_urls(document, base_url))
}

/// Thoroughly delete a document: the document row + all its jobs
/// (including `-ocr` sub-jobs) + upload(s) + on-disk files. Follows
/// the library-deletion favorite-protection logic — if it's referenced
/// by any favorite, return 409 (force does not bypass this, keeping it
/// consistent with `delete_library_book`; force only bypasses the
/// "cannot delete running job" check).
///
/// Documents that were "catalogued only" (no book job) can still be
/// thoroughly deleted here (this is their only deletion entry point).
pub fn delete_document(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    force: bool,
) -> Result<DocumentDeleteResultView, AppError> {
    let _document = deps
        .db
        .get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;

    // Favorite protection: deleting a document would break all its
    // anchors; we refuse to silently destroy user-curated content.
    let favorites = deps.db.favorites_count_for_document(document_id)?;
    if favorites > 0 {
        return Err(AppError::conflict(format!(
            "document is referenced by {favorites} favorite(s); remove the favorites first"
        )));
    }

    // Collect all jobs under the document: those linked via
    // `jobs.document_id` plus each one's `-ocr` sub-job.
    let mut job_ids = deps.db.job_ids_for_document(document_id)?;
    for job_id in job_ids.clone() {
        let child = format!("{job_id}-ocr");
        if !job_ids.contains(&child) && deps.db.get_job(&child).is_ok() {
            job_ids.push(child);
        }
    }

    // Validate each job for deletability (running jobs require `force`).
    let mut jobs = Vec::new();
    for job_id in &job_ids {
        if let Ok(job) = deps.db.get_job(job_id) {
            ensure_deletable(&job, force)?;
            jobs.push(job);
        }
    }

    let mut removed_jobs = Vec::new();
    let mut removed_paths = Vec::new();
    for job in &jobs {
        removed_paths.extend(remove_job_files(deps, &job.job_id)?);
        deps.db.delete_job(&job.job_id)?;
        removed_jobs.push(job.job_id.clone());
    }

    // Delete upload records and their on-disk directories (`uploads/<upload_id>/...`).
    for upload in deps.db.uploads_for_document(document_id)? {
        let stored = PathBuf::from(&upload.stored_path);
        if let Some(parent) = stored.parent() {
            remove_path_if_exists(parent.to_path_buf(), &mut removed_paths)?;
        } else {
            remove_path_if_exists(stored, &mut removed_paths)?;
        }
        deps.db.delete_upload(&upload.upload_id)?;
    }

    // Finally delete the document row (FK cascade cleans tags/collection_documents;
    // ai_conversations is set to NULL) + FTS rows.
    let deleted = deps.db.delete_document(document_id)?;

    Ok(DocumentDeleteResultView {
        deleted,
        document_id: document_id.to_string(),
        removed_jobs,
        removed_paths,
    })
}

pub fn patch_document(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    payload: &PatchDocumentInput,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    if let Some(status) = payload.reading_status.as_deref() {
        if !matches!(status, "unread" | "reading" | "done") {
            return Err(AppError::bad_request(
                "reading_status must be one of: unread, reading, done",
            ));
        }
    }
    let document = deps
        .db
        .update_document_fields(
            document_id,
            payload.title.as_deref(),
            payload.reading_status.as_deref(),
            payload.tags.as_deref(),
        )
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    Ok(with_document_media_urls(document, base_url))
}
