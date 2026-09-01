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
    throw new Error(`Failed to load the document library. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope<MockDocumentListResult>(await resp.json());
}

// 按任意 job_id(含History run)直查其所属Documents,后端负责parse——前端不再扫List反查.
// 返回该Documents记录或 null(job 不属于任何Documents时).
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
    throw new Error(`Failed to find document by job. Please retry later.(${resp.status})`);
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
    throw new Error(`Failed to load document details. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// body 支持 { title?, reading_status?, tags? };tags yes整体替换语义(传 [] 即清空)
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
    throw new Error(`${envelope?.message || "Failed to update document. Please retry later."}(${resp.status})`);
  }
  return unwrapEnvelope<DocumentRecord>(await resp.json());
}

// Documents级Delete:删掉 document + 名下所有 job/upload/Files(后端 DELETE /documents/:id).
// 被Favorite引用时后端返回 409(force 可覆盖运行中的 job,不覆盖Favorite保护).
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
    const error = new Error(`${envelope?.message || "Failed to delete document. Please retry later."}(${resp.status})`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return unwrapEnvelope(await resp.json());
}

// 对LibraryDocuments发起"以后再翻":复用Documents已存的 upload 起 book Translation job.
// 后端 translate_document 会注入该Documents的 upload_id 并把 workflow 归一到 book/translate,
// 前端只需带一个最小 CreateJobInput(workflow 缺省即 book).返回 JobSubmissionView.
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
    throw new Error(`${envelope?.message || "Failed to start translation. Please retry later."}(${resp.status})`);
  }
  return unwrapEnvelope<JobSubmissionView>(await resp.json());
}




