import {
  isMockMode,
  readerMessageTargetOrigin,
} from "../config/runtime.js";
import { getMockJobId } from "../mock/index.js";

function defaultSearch() {
  return globalThis.window?.location?.search || "";
}

export function resolveReaderJobId({
  search = defaultSearch(),
  isMock = isMockMode,
  mockJobId = getMockJobId,
} = {}) {
  const jobId = new URLSearchParams(search).get("job_id")?.trim() || "";
  if (jobId) {
    return jobId;
  }
// ?document_id= Collection document "Read Original" entry (F4): No current job, do not fall back to mock job,
  // Otherwise source document reader hangs. mock Task.
  const documentId = new URLSearchParams(search).get("document_id")?.trim() || "";
  if (documentId) {
    return "";
  }
  return isMock() ? mockJobId() : "";
}

// Collection document "Read Original" (F4): when jobonly document_id is missing, reader uses read-only source document branch.
export function resolveReaderDocumentId({ search = defaultSearch() } = {}) {
  return new URLSearchParams(search).get("document_id")?.trim() || "";
}

// Anchor (page_idx, block_id) Pass-through from search hit/Favorite back-jump URL
export function resolveReaderAnchor({ search = defaultSearch() } = {}) {
  const params = new URLSearchParams(search);
  const rawPageIdx = `${params.get("page_idx") ?? ""}`.trim();
  const blockId = `${params.get("block_id") || ""}`.trim();
  const pageIdx = rawPageIdx === "" ? NaN : Number(rawPageIdx);
  if (!Number.isFinite(pageIdx) && !blockId) {
    return null;
  }
  return {
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId,
  };
}

export function createReaderPageConfigPort({
  messageTargetOrigin = readerMessageTargetOrigin,
  isMock = isMockMode,
  mockJobId = getMockJobId,
  search = defaultSearch,
} = {}) {
  function readerJobId() {
    return resolveReaderJobId({
      search: search(),
      isMock,
      mockJobId,
    });
  }

  return Object.freeze({
    messageTargetOrigin,
    readerJobId,
  });
}

export const defaultReaderPageConfigPort = createReaderPageConfigPort();
