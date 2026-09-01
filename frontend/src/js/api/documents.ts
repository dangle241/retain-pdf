import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  deleteMockDocument,
  getMockDocument,
  getMockDocumentByJobId,
  getMockDocumentList,
  patchMockDocument,
  translateMockDocument,
  type MockDocumentListResult,
  type MockDocumentPatch,
  type MockDocumentWithMedia,
} from "../mock/documents.js";
import type { JobSubmissionView } from "../../pages/home/features/library/types.js";
import { buildApiEndpoint } from "./http.js";

/** Document record returned by documents API (media URLs included). */
export type DocumentRecord = MockDocumentWithMedia;

export async function fetchDocumentList(
  apiPrefix: string,
  {
    limit = 50,
    offset = 0,
    readingStatus = "",
    tag = "",
    collectionId = "",
  }: {
    limit?: number;
    offset?: number;
    readingStatus?: string;
    tag?: string;
    collectionId?: string;
  } = {},
): Promise<MockDocumentListResult> {
  if (isMockMode()) {
    return getMockDocumentList({ limit, offset, readingStatus, tag, collectionId });
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${readingStatus || ""}`.trim()) {
    params.set("reading_status", `${readingStatus}`.trim());
  }
  if (`${tag || ""}`.trim()) {
    params.set("tag", `${tag}`.trim());
  }
  if (`${collectionId || ""}`.trim()) {
    params.set("collection_id", `${collectionId}`.trim());
  }
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Failed to read document library, please try again later.(${resp.status})`);
  }
  return unwrapEnvelope<MockDocumentListResult>(await resp.json());
}

// Directly query the document of any job_id (including historical runs); backend handles parsing. Frontend no longer scans list for reverse lookup.
// Return the document record or null(job When not part of any document)。
export async function fetchDocumentByJobId(
  apiPrefix: string,
  jobId: string,
): Promise<DocumentRecord | null> {
  const normalized = `${jobId || ""}`.trim();
  if (!normalized) {
    return null;
  }
  if (isMockMode()) {
    return getMockDocumentByJobId(normalized);
  }
  const params = new URLSearchParams();
  params.set("job_id", normalized);
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "documents")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
throw new Error(Failed to fetch docs by job. Please try again later. (${resp.status}));
  }
  const payload = unwrapEnvelope<MockDocumentListResult>(await resp.json()) || {
    documents: [],
    total: 0,
    limit: 0,
    offset: 0,
  };
  const { documents = [] } = payload;
  return Array.isArray(documents) && documents.length ? documents[0] : null;
}

export async function fetchDocument(
  apiPrefix: string,
  documentId: string,
): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
throw new Error("Missing document_id.");
  }
  if (isMockMode()) {
    return getMockDocument(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Failed to read document details, please try again later.(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// body supports { title?, reading_status?, tags? }; tags use global replace semantics (pass [] to clear now)
export async function patchDocument(
  apiPrefix: string,
  documentId: string,
  payload: MockDocumentPatch = {},
): Promise<DocumentRecord> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
throw new Error("Missing document_id.");
  }
  if (isMockMode()) {
    return patchMockDocument(normalized, payload);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`), {
    method: "PATCH",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Update failed. Try again later."}(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// Document-level deletion: delete document and all associated jobs/uploads/files (backend DELETE /documents/:id).
// Backend returns when referenced by favorites 409(force Overwrite running job,Do not override favorite protection)。
export async function deleteDocument(apiPrefix, documentId, { force = false } = {}) {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
throw new Error("Missing document_id.");
  }
  if (isMockMode()) {
    return deleteMockDocument(normalized);
  }
  const params = force ? "?force=true" : "";
  const resp = await fetch(
    buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}`) + params,
    { method: "DELETE", headers: buildApiHeaders() },
  );
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    const error = new Error(`${envelope?.message || "Failed to delete document. Please try again later."}(${resp.status})`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return unwrapEnvelope(await resp.json());
}

// Initiate on collection documents 「Translate later」: reuse existing docs' upload to start a book translation job.
// Backend translate_document injects this document's upload_id and workflow normalizes to book/translate,
// Frontend only needs one minimum CreateJobInput(workflow Default is book)Return JobSubmissionView。
export async function translateDocument(
  apiPrefix: string,
  documentId: string,
  payload: Record<string, unknown> = {},
): Promise<JobSubmissionView> {
  const normalized = `${documentId || ""}`.trim();
  if (!normalized) {
throw new Error("Missing document_id.");
  }
  if (isMockMode()) {
    return translateMockDocument(normalized);
  }
  const resp = await fetch(
    buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(normalized)}/translate`),
    {
      method: "POST",
      headers: {
        ...buildApiHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Translation failed. Retry later."}(${resp.status})`);
  }
  return unwrapEnvelope<JobSubmissionView>(await resp.json());
}
