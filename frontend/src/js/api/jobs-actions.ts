import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { currentMockScenario } from "../mock/scenario.js";
import {
  buildLiveMockJobPayload,
  registerLiveMockJob,
} from "../mock/live-jobs.js";
import {
  bindMockDocumentActiveJob,
  getMockDocumentByJobId,
} from "../mock/documents.js";
import { buildJobDetailEndpoint, submitJson } from "./http.js";

export async function fetchJobDiagnostics(jobId, apiPrefix) {
  if (isMockMode()) {
// Keep fields same-origin with mock/job.js's failure, avoid detail popup (reading job.failure)
// Inconsistent display with detail page (reading this endpoint) below in mock
    if (currentMockScenario() !== "failed") {
      return null;
    }
    return {
      job_id: jobId,
      summary: "Task failed, but it's frontend. mock Scenario.",
      category: "mock_render_failure",
      failed_stage: "render",
root_cause: "Simulated failure for UI debugging.",
suggestion: "Switch ?mock=succeeded to view success state.",
      detail: "",
      retryable: true,
      resume_available: true,
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/diagnostics`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`Failed to read failure diagnosis, please try again later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchResumePlan(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      can_resume: true,
      from_stage: "render",
      resume_workflow: "render",
      reuses_artifacts: ["translations_dir", "source_pdf"],
      reruns_stages: ["render"],
      reason: "mock resume plan",
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/resume-plan`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`Failed to read recovery plan, please try again later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function resumeJob(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: `mock-resume-${Date.now()}`,
      status: "queued",
    };
  }
  return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/resume`, {});
}

export async function fetchJobStageActions(jobId, apiPrefix) {
  if (isMockMode()) {
    return {
      job_id: jobId,
      stages: [
        { stage: "ocr", label: "Rebuild project. Clean cache. OCR", can_retry: true, disabled_reason: "" },
        { stage: "translation", label: "重新翻译", can_retry: true, disabled_reason: "" },
        { stage: "render", label: "重新渲染", can_retry: true, disabled_reason: "" },
      ],
    };
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/stage-actions`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`Failed to read stage actions, please try again later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function retryJobStage(jobId, apiPrefix, stage, payload = {}) {
  const normalizedStage = `${stage || ""}`.trim();
  if (!normalizedStage) {
throw new Error("Stage retry failed: missing stage");
  }
  if (isMockMode()) {
    // Start from specified stage; must bind back to original documentotherwise the bookshelf will have an extra「job_id Empty shell card」
    const bookMeta = payload && typeof payload === "object" ? payload : {};
    // snapshot Often missing document_idUse source job → Reverse lookup document table.
    const linkedDoc = getMockDocumentByJobId(jobId);
    const documentId = `${bookMeta.document_id || linkedDoc?.document_id || ""}`.trim();
    const bookTitle = `${bookMeta.title || bookMeta.display_name || linkedDoc?.title || ""}`.trim();
    const live = registerLiveMockJob({
      jobId: `mock-${normalizedStage}-retry-${Date.now()}`,
      documentId: documentId || undefined,
      title: bookTitle || undefined,
      pageCount: Number(bookMeta.page_count || linkedDoc?.page_count) || undefined,
      fromStage: normalizedStage,
    });
    const docBound = documentId
      ? bindMockDocumentActiveJob(documentId, live.jobId, { previousJobId: jobId })
      : null;
    const snapshot = buildLiveMockJobPayload(live.jobId) || {};
    return {
      job_id: live.jobId,
      source_job_id: jobId,
      document_id: documentId || snapshot.document_id,
      title: bookTitle || docBound?.title || snapshot.title,
      display_name: bookTitle || docBound?.title || snapshot.display_name,
      cover_url: bookMeta.cover_url || linkedDoc?.cover_url || docBound?.cover_url,
      thumbnail_url: bookMeta.thumbnail_url || linkedDoc?.thumbnail_url || docBound?.thumbnail_url,
      page_count: bookMeta.page_count ?? linkedDoc?.page_count ?? docBound?.page_count ?? snapshot.page_count,
      status: snapshot.status || "running",
      stage: snapshot.stage || normalizedStage,
      display_stage: snapshot.display_stage,
      stage_detail: snapshot.stage_detail,
      progress: snapshot.progress,
      runtime: snapshot.runtime,
      timestamps: snapshot.timestamps,
      library_only: false,
      active_job_id: live.jobId,
      rerun_from_stage: normalizedStage,
    };
  }
  const result = await submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/retry-stage`, {
    stage: normalizedStage,
    ...payload,
  });
// Real backend omits book fields: add them from source/document/title to avoid inserting empty job_id shell card on shelf.
  const bookMeta = payload && typeof payload === "object" ? payload : {};
  const nextJobId = `${result?.job_id || result?.id || jobId}`.trim();
  return {
    ...result,
    job_id: nextJobId,
    source_job_id: jobId,
    document_id: result?.document_id || bookMeta.document_id,
    title: bookMeta.title || bookMeta.display_name || result?.title,
    display_name: bookMeta.display_name || bookMeta.title || result?.display_name,
    cover_url: bookMeta.cover_url || result?.cover_url,
    thumbnail_url: bookMeta.thumbnail_url || result?.thumbnail_url,
    page_count: bookMeta.page_count ?? result?.page_count,
    library_only: false,
    active_job_id: nextJobId,
  };
}

export async function rerunJob(actionUrl) {
  if (isMockMode()) {
    void actionUrl;
    return {
      job_id: `mock-rerun-${Date.now()}`,
      status: "queued",
    };
  }
  return submitJson(actionUrl, {});
}
