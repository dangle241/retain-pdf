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
  // ?document_id= is the Library "Read Source" entry (F4): no job present, should not fall back to mock job,
  // otherwise source-document Reader would incorrectly attach a mock task.
  const documentId = new URLSearchParams(search).get("document_id")?.trim() || "";
  if (documentId) {
    return "";
  }
  return isMock() ? mockJobId() : "";
}

// Library "Read Source" (F4): no job, only document_id → Reader runs read-only source-document branch.
export function resolveReaderDocumentId({ search = defaultSearch() } = {}) {
  return new URLSearchParams(search).get("document_id")?.trim() || "";
}

// Anchor (page_idx, block_id) passed through URL from search hit / favorite jump-back
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




