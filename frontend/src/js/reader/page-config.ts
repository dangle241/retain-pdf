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
  // ?document_id= là entry "Đọc nguyên văn" cho tài liệu thư viện (F4): lúc này không có job và không được lùi về mock job,
  // nếu không trình đọc tài liệu nguồn sẽ gắn nhầm tác vụ mock.
  const documentId = new URLSearchParams(search).get("document_id")?.trim() || "";
  if (documentId) {
    return "";
  }
  return isMock() ? mockJobId() : "";
}

// "Đọc nguyên văn" tài liệu thư viện (F4): khi không có job, chỉ có document_id, trình đọc dùng nhánh tài liệu nguồn chỉ đọc.
export function resolveReaderDocumentId({ search = defaultSearch() } = {}) {
  return new URLSearchParams(search).get("document_id")?.trim() || "";
}

// Điểm neo (page_idx, block_id) được truyền qua URL từ kết quả tìm kiếm/mục đã lưu quay lại.
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
