import { MOCK_JOB_ID } from "./constants.js";
import {
  buildLiveMockJobPayload,
  isLiveMockJobActive,
  registerLiveMockJob,
} from "./live-jobs.js";
import type { JobSubmissionView } from "../../pages/home/features/library/types.js";

export const MOCK_DOCUMENT_ID = "doc-9f2a41c8e77b";

/** API-shaped document record (mirrors backend documents layer). */
export type MockReadingStatus = "unread" | "reading" | "done";

export interface MockDocument {
  document_id: string;
  title: string;
  source_filename: string;
  page_count: number;
  bytes: number;
  active_job_id: string | null;
  reading_status: MockReadingStatus | string;
  tags: string[];
  added_at: string;
  updated_at: string;
  last_opened_at?: string | null;
  [key: string]: unknown;
}

/** Document after API media-url enrichment. */
export interface MockDocumentWithMedia extends MockDocument {
  source_pdf_url: string;
  cover_url: string;
  thumbnail_url: string;
}

export interface MockDocumentListQuery {
  limit?: number;
  offset?: number;
  readingStatus?: string;
  tag?: string;
  collectionId?: string;
}

export interface MockDocumentListResult {
  documents: MockDocumentWithMedia[];
  total: number;
  limit: number;
  offset: number;
}

export interface MockDocumentPatch {
  title?: string;
  reading_status?: MockReadingStatus | string;
  tags?: string[];
}

export interface MockCollection {
  collection_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface MockCollectionWithCount extends MockCollection {
  document_count: number;
}

export interface MockCollectionCreate {
  name?: string;
  parent_id?: string | null;
}

export interface MockCollectionPatch {
  name?: string;
  sort_order?: number;
}

export type MockFavoriteKind = "sentence" | "data" | "figure" | string;

export interface MockFavorite {
  favorite_id: string;
  document_id: string;
  job_id: string;
  page_idx: number;
  block_id: string;
  kind: MockFavoriteKind;
  quote_text: string;
  translated_quote_text: string;
  note: string;
  created_at: string;
  char_start?: number;
  char_end?: number;
}

export interface MockFavoriteCreatePayload {
  document_id?: string;
  job_id?: string;
  page_idx?: number;
  block_id?: string;
  kind?: MockFavoriteKind;
  quote_text?: string;
  translated_quote_text?: string;
  note?: string;
  char_start?: number;
  char_end?: number;
}

export interface MockSearchHit {
  document_id: string;
  job_id: string;
  page_idx: number;
  block_id: string;
  source_snippet: string;
  translated_snippet: string;
}

type HttpStatusError = Error & { status?: number };

// Nhất quán với hình dạng lớp dữ liệu documents của backend (xem hướng dẫn tích hợp backend):
// document = định danh ổn định được loại trùng theo hash nội dung; job là bản ghi xử lý thuộc tài liệu.
function buildMockDocuments(): MockDocument[] {
  return [
    {
      document_id: MOCK_DOCUMENT_ID,
      title: "Vai trò của sự liên hợp đối với tính chọn lọc trao đổi halogen-lithi",
      source_filename: "halogen-lithium-exchange.pdf",
      page_count: 10,
      bytes: 2_621_440,
      active_job_id: MOCK_JOB_ID,
      reading_status: "reading",
      tags: ["Hóa học", "Tổng hợp hữu cơ"],
      added_at: "2026-06-01T10:00:00Z",
      updated_at: "2026-06-01T12:00:00Z",
    },
    {
      document_id: "doc-1b8c52d9a304",
      title: "Attention Is All You Need",
      source_filename: "attention.pdf",
      page_count: 15,
      bytes: 1_843_200,
      active_job_id: "20260520-att-001",
      reading_status: "done",
      tags: ["Học máy"],
      added_at: "2026-05-20T08:00:00Z",
      updated_at: "2026-05-21T09:30:00Z",
    },
    {
      document_id: "doc-77e0fa3c1d55",
      title: "Scaling Laws for Neural Language Models",
      source_filename: "scaling-laws.pdf",
      page_count: 30,
      bytes: 4_115_000,
      active_job_id: "20260601-scl-002",
      reading_status: "unread",
      tags: [],
      added_at: "2026-06-08T14:00:00Z",
      updated_at: "2026-06-08T14:00:00Z",
    },
    // Trạng thái thư viện (chỉ lưu, chưa dịch): active_job_id rỗng. Lưới trung tâm tài liệu phải hiển thị được chúng,
    // trình đọc phải đọc nguyên văn ở chế độ chỉ đọc và thẻ phải hỗ trợ "dịch sau".
    {
      document_id: "doc-ref-6a1f2c",
      title: "Sổ tay Reaxys Retrosynthesis (chỉ lưu trong thư viện)",
      source_filename: "reaxys-handbook.pdf",
      page_count: 42,
      bytes: 3_200_000,
      active_job_id: null,
      reading_status: "unread",
      tags: ["Sách tham khảo"],
      added_at: "2026-06-10T09:00:00Z",
      updated_at: "2026-06-10T09:00:00Z",
    },
    {
      document_id: "doc-ref-9b7e04",
      title: "Bài giảng Lý thuyết nhóm (chỉ lưu trong thư viện)",
      source_filename: "group-theory-notes.pdf",
      page_count: 88,
      bytes: 5_600_000,
      active_job_id: "",
      reading_status: "reading",
      tags: [],
      added_at: "2026-06-12T15:30:00Z",
      updated_at: "2026-06-12T15:30:00Z",
    },
  ];
}

// Phản chiếu with_document_media_urls của backend. Bìa/ảnh thu nhỏ dùng mock://,
// tránh /api/v1/documents/.../cover trả 404 trong mô phỏng frontend thuần và gây bìa trống.
export const MOCK_DOCUMENT_SOURCE_PDF_URL = "mock://document-source.pdf";
export const MOCK_DOCUMENT_COVER_URL = "mock://document-cover.png";
export const MOCK_DOCUMENT_THUMB_URL = "mock://document-thumb.png";

function withMockDocumentMediaUrls(document: MockDocument): MockDocumentWithMedia {
  return {
    ...document,
    source_pdf_url: MOCK_DOCUMENT_SOURCE_PDF_URL,
    cover_url: MOCK_DOCUMENT_COVER_URL,
    thumbnail_url: MOCK_DOCUMENT_THUMB_URL,
  };
}

let mockDocuments: MockDocument[] | null = null;

function documents(): MockDocument[] {
  if (!mockDocuments) {
    mockDocuments = buildMockDocuments();
  }
  return mockDocuments;
}

export function getMockDocumentList({
  limit = 50,
  offset = 0,
  readingStatus = "",
  tag = "",
  collectionId = "",
}: MockDocumentListQuery = {}): MockDocumentListResult {
  let list = documents();
  if (`${readingStatus}`.trim()) {
    list = list.filter((item) => item.reading_status === `${readingStatus}`.trim());
  }
  if (`${tag}`.trim()) {
    list = list.filter((item) => item.tags.includes(`${tag}`.trim()));
  }
  if (`${collectionId}`.trim()) {
    const memberIds = collectionMembership(`${collectionId}`.trim());
    list = list.filter((item) => memberIds.has(item.document_id));
  }
  return {
    documents: list.slice(offset, offset + limit).map(withMockDocumentMediaUrls),
    total: list.length,
    limit,
    offset,
  };
}

export function getMockDocument(documentId: string): MockDocumentWithMedia {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("Không tìm thấy tài liệu. (404)");
  }
  return withMockDocumentMediaUrls(found);
}

// Backend tra trực tiếp tài liệu theo job_id: khớp active_job_id đương nhiên được tính,
// run lịch sử (bản ghi dịch cũ của cùng tài liệu) cũng phải phân giải tới tài liệu đó; dùng map lịch sử để chứng minh luồng này hoạt động.
const MOCK_HISTORICAL_JOB_TO_DOCUMENT: Record<string, string> = {
  "mock-job-20260101-old": MOCK_DOCUMENT_ID,
};

export function getMockDocumentByJobId(jobId: string): MockDocumentWithMedia | null {
  const normalized = `${jobId || ""}`.trim();
  if (!normalized) {
    return null;
  }
  const byActive = documents().find((item) => item.active_job_id === normalized);
  if (byActive) {
    return withMockDocumentMediaUrls(byActive);
  }
  const historicalDocId = MOCK_HISTORICAL_JOB_TO_DOCUMENT[normalized];
  if (historicalDocId) {
    const doc = documents().find((item) => item.document_id === historicalDocId);
    return doc ? withMockDocumentMediaUrls(doc) : null;
  }
  return null;
}

/**
 * Gắn job thử lại/mới vào tài liệu: cập nhật active_job_id và đăng ký map lịch sử,
 * để getMockDocumentByJobId(id mới) vẫn lấy được tên sách/bìa.
 */
export function bindMockDocumentActiveJob(
  documentId?: string | null,
  jobId?: string | null,
  options: { previousJobId?: string | null } = {},
): MockDocumentWithMedia | null {
  const docId = `${documentId || ""}`.trim();
  const nextJobId = `${jobId || ""}`.trim();
  if (!docId || !nextJobId) {
    return null;
  }
  const found = documents().find((item) => item.document_id === docId);
  if (!found) {
    return null;
  }
  const previous = `${options.previousJobId || found.active_job_id || ""}`.trim();
  found.active_job_id = nextJobId;
  found.updated_at = new Date().toISOString();
  if (previous && previous !== nextJobId) {
    MOCK_HISTORICAL_JOB_TO_DOCUMENT[previous] = docId;
  }
  MOCK_HISTORICAL_JOB_TO_DOCUMENT[nextJobId] = docId;
  return withMockDocumentMediaUrls(found);
}

// Bản mô phỏng DELETE /documents/:id: xóa tài liệu khỏi bảng mock cùng quan hệ thành viên bộ sưu tập.
// Ném 409 khi được mục đã lưu tham chiếu (phản chiếu bảo vệ của backend).
export function deleteMockDocument(documentId: string): {
  deleted: boolean;
  document_id: string;
  removed_paths: string[];
} {
  const list = documents();
  const index = list.findIndex((item) => item.document_id === documentId);
  if (index < 0) {
    throw new Error("Không tìm thấy tài liệu. (404)");
  }
  const favoriteCount = favorites().filter((item) => item.document_id === documentId).length;
  if (favoriteCount > 0) {
    const error: HttpStatusError = new Error(
      `Tài liệu có ${favoriteCount} mục yêu thích; vui lòng xóa các mục đó trước khi xóa tài liệu. (409)`,
    );
    error.status = 409;
    throw error;
  }
  list.splice(index, 1);
  if (mockCollectionMembership) {
    for (const members of mockCollectionMembership.values()) {
      members.delete(documentId);
    }
  }
  return { deleted: true, document_id: documentId, removed_paths: [] };
}

const READING_STATUSES: MockReadingStatus[] = ["unread", "reading", "done"];

export function patchMockDocument(
  documentId: string,
  { title, reading_status: readingStatus, tags }: MockDocumentPatch = {},
): MockDocumentWithMedia {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("Không tìm thấy tài liệu. (404)");
  }
  if (readingStatus !== undefined && !READING_STATUSES.includes(readingStatus as MockReadingStatus)) {
    throw new Error("reading_status chỉ hỗ trợ unread | reading | done. (400)");
  }
  if (title !== undefined) {
    found.title = `${title}`;
  }
  if (readingStatus !== undefined) {
    found.reading_status = readingStatus;
  }
  if (tags !== undefined) {
    // Ngữ nghĩa thay thế toàn bộ.
    found.tags = Array.isArray(tags) ? tags.map((item) => `${item}`) : [];
  }
  found.updated_at = new Date().toISOString();
  return withMockDocumentMediaUrls(found);
}

// Bản mô phỏng POST /documents/:id/translate: đăng ký tác vụ live có thể tiến triển,
// poll getMockJobPayload sẽ đi qua OCR→dịch→kết xuất→hoàn tất theo thời gian (xem mock/live-jobs).
// Gửi lại khi đang chạy → 409; có thể gửi lại sau trạng thái cuối để thuận tiện demo nhiều lần.
export function translateMockDocument(documentId: string): JobSubmissionView {
  const found = documents().find((item) => item.document_id === documentId);
  if (!found) {
    throw new Error("Không tìm thấy tài liệu. (404)");
  }
  const existingId = `${found.active_job_id || ""}`.trim();
  if (existingId && isLiveMockJobActive(existingId)) {
    throw new Error("Tài liệu đã nằm trong quy trình dịch. (409)");
  }
  const live = registerLiveMockJob({
    documentId: found.document_id,
    title: found.title,
    pageCount: found.page_count,
  });
  found.active_job_id = live.jobId;
  found.updated_at = new Date().toISOString();
  const snapshot = buildLiveMockJobPayload(live.jobId) || {};
  return {
    job_id: live.jobId,
    document_id: found.document_id,
    status: `${snapshot.status || "queued"}`,
    stage: `${snapshot.stage || "queued"}`,
    display_stage: `${snapshot.display_stage || "ocr"}`,
    stage_detail: `${snapshot.stage_detail || "Đang tải trạng thái tác vụ..."}`,
  };
}

// ===== Phân loại (bộ sưu tập): tạo thư mục để nhóm PDF =====
// Đồng cấu với js/api/collections.js (collection_id/name/parent_id/sort_order/
// created_at/document_count); membership được lưu riêng dưới dạng collection_id → Set<document_id>
// với cùng cách mô hình hóa như bảng collection_documents của backend thật.

let mockCollections: MockCollection[] | null = null;
let mockCollectionMembership: Map<string, Set<string>> | null = null;
let collectionSeq = 0;

function seedMockCollections(): void {
  collectionSeq = 2;
  mockCollections = [
    { collection_id: "col-001", name: "Hóa học", parent_id: null, sort_order: 0, created_at: "2026-06-01T10:30:00Z" },
    { collection_id: "col-002", name: "Học máy", parent_id: null, sort_order: 1, created_at: "2026-06-08T15:00:00Z" },
  ];
  // Danh sách "tác vụ gần đây" mô phỏng (js/mock/index.js#getMockJobList) hiện chỉ có MOCK_JOB_ID
  // là dữ liệu thật duy nhất; active_job_id của doc-1b8c52d9a304/doc-77e0fa3c1d55 không có trong
  // danh sách job; để thư mục "Học máy" trống nhằm bao phủ trạng thái UI thật "thư mục trống".
  mockCollectionMembership = new Map([
    ["col-001", new Set([MOCK_DOCUMENT_ID])],
    ["col-002", new Set()],
  ]);
}

function collectionsList(): MockCollection[] {
  if (!mockCollections) {
    seedMockCollections();
  }
  return mockCollections!;
}

function collectionMembership(collectionId: string): Set<string> {
  if (!mockCollectionMembership) {
    seedMockCollections();
  }
  if (!mockCollectionMembership!.has(collectionId)) {
    mockCollectionMembership!.set(collectionId, new Set());
  }
  return mockCollectionMembership!.get(collectionId)!;
}

function collectionWithCount(record: MockCollection): MockCollectionWithCount {
  return { ...record, document_count: collectionMembership(record.collection_id).size };
}

export function getMockCollectionList(): { collections: MockCollectionWithCount[] } {
  const list = [...collectionsList()].sort((a, b) => a.sort_order - b.sort_order);
  return { collections: list.map(collectionWithCount) };
}

export function createMockCollection({
  name,
  parent_id: parentId = null,
}: MockCollectionCreate = {}): MockCollectionWithCount {
  const trimmed = `${name || ""}`.trim();
  if (!trimmed) {
    throw new Error("name must not be empty. (400)");
  }
  collectionsList(); // Đảm bảo dữ liệu hạt giống và collectionSeq được khởi tạo.
  collectionSeq += 1;
  const record: MockCollection = {
    collection_id: `col-${String(collectionSeq).padStart(3, "0")}`,
    name: trimmed,
    parent_id: parentId || null,
    sort_order: collectionsList().length,
    created_at: new Date().toISOString(),
  };
  collectionsList().push(record);
  return collectionWithCount(record);
}

export function patchMockCollection(
  collectionId: string,
  { name, sort_order: sortOrder }: MockCollectionPatch = {},
): MockCollectionWithCount {
  const found = collectionsList().find((item) => item.collection_id === collectionId);
  if (!found) {
    throw new Error("Không tìm thấy danh mục. (404)");
  }
  if (name !== undefined) {
    const trimmed = `${name}`.trim();
    if (!trimmed) {
      throw new Error("name must not be empty. (400)");
    }
    found.name = trimmed;
  }
  if (sortOrder !== undefined) {
    found.sort_order = Number(sortOrder) || 0;
  }
  return collectionWithCount(found);
}

export function deleteMockCollection(collectionId: string): { deleted: boolean } {
  const list = collectionsList();
  const index = list.findIndex((item) => item.collection_id === collectionId);
  if (index < 0) {
    throw new Error("Không tìm thấy danh mục. (404)");
  }
  list.splice(index, 1);
  if (mockCollectionMembership) {
    mockCollectionMembership.delete(collectionId);
  }
  return { deleted: true };
}

export function addMockCollectionDocuments(
  collectionId: string,
  documentIds: Array<string | null | undefined> = [],
): MockCollectionWithCount {
  const found = collectionsList().find((item) => item.collection_id === collectionId);
  if (!found) {
    throw new Error("Không tìm thấy danh mục. (404)");
  }
  const members = collectionMembership(collectionId);
  for (const documentId of documentIds) {
    const normalized = `${documentId || ""}`.trim();
    if (!normalized) {
      continue;
    }
    if (!documents().some((item) => item.document_id === normalized)) {
      throw new Error(`Không tìm thấy tài liệu: ${normalized} (404)`);
    }
    members.add(normalized);
  }
  return collectionWithCount(found);
}

export function removeMockCollectionDocument(
  collectionId: string,
  documentId: string,
): { removed: boolean } {
  const members = collectionMembership(collectionId);
  const normalized = `${documentId || ""}`.trim();
  if (!members.has(normalized)) {
    throw new Error("Tài liệu không thuộc danh mục này. (404)");
  }
  members.delete(normalized);
  return { removed: true };
}

// ===== Mục đã lưu =====

let mockFavorites: MockFavorite[] | null = null;
let favoriteSeq = 0;

function favorites(): MockFavorite[] {
  if (!mockFavorites) {
    favoriteSeq = 2;
    mockFavorites = [
      {
        favorite_id: "fav-001",
        document_id: MOCK_DOCUMENT_ID,
        job_id: MOCK_JOB_ID,
        page_idx: 0,
        block_id: "b-intro-3",
        kind: "sentence",
        quote_text: "Tổng hợp hữu cơ hiện đại đã đạt độ chính xác rất cao.",
        translated_quote_text: "",
        note: "",
        created_at: "2026-06-01T11:00:00Z",
      },
      {
        favorite_id: "fav-002",
        document_id: MOCK_DOCUMENT_ID,
        job_id: MOCK_JOB_ID,
        page_idx: 2,
        block_id: "b-scheme-1b",
        kind: "figure",
        quote_text: "Scheme 1b",
        translated_quote_text: "",
        note: "Ảnh hưởng của độ cứng hệ naphthalen đến cản trở không gian",
        created_at: "2026-06-01T11:20:00Z",
      },
    ];
  }
  return mockFavorites;
}

export function createMockFavorite(payload: MockFavoriteCreatePayload = {}): MockFavorite {
  const quoteText = `${payload.quote_text || ""}`.trim();
  const jobId = `${payload.job_id || ""}`.trim();
  // document_id có thể bỏ qua: khi có job_id, backend phân giải tài liệu tương ứng (gồm run lịch sử). Phải có ít nhất một trong hai.
  const doc = `${payload.document_id || ""}`.trim()
    ? documents().find((item) => item.document_id === `${payload.document_id}`.trim())
    : (jobId ? getMockDocumentByJobId(jobId) : null);
  if (!doc || payload.page_idx === undefined || !payload.block_id || !quoteText) {
    throw new Error("Bắt buộc có document_id hoặc job_id, cùng page_idx, block_id và quote_text. (400)");
  }
  favorites(); // Đảm bảo dữ liệu hạt giống và favoriteSeq được khởi tạo trước khi cấp id mới.
  favoriteSeq += 1;
  const favorite: MockFavorite = {
    favorite_id: `fav-${String(favoriteSeq).padStart(3, "0")}`,
    document_id: doc.document_id,
    // Nếu không truyền job_id, neo vào active_job_id của tài liệu.
    job_id: jobId || doc.active_job_id || "",
    page_idx: Number(payload.page_idx) || 0,
    block_id: `${payload.block_id}`,
    kind: ["sentence", "data", "figure"].includes(payload.kind as string) ? payload.kind! : "sentence",
    quote_text: quoteText,
    translated_quote_text: `${payload.translated_quote_text || ""}`,
    note: `${payload.note || ""}`,
    char_start: payload.char_start,
    char_end: payload.char_end,
    created_at: new Date().toISOString(),
  };
  favorites().push(favorite);
  return { ...favorite };
}

export function getMockFavorites({ documentId = "" }: { documentId?: string } = {}): {
  favorites: MockFavorite[];
} {
  const normalized = `${documentId || ""}`.trim();
  const list = normalized
    ? favorites().filter((item) => item.document_id === normalized)
        .sort((a, b) => a.page_idx - b.page_idx)
    : [...favorites()].sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
  return { favorites: list.map((item) => ({ ...item })) };
}

export function deleteMockFavorite(favoriteId: string): { favorite_id: string } {
  const list = favorites();
  const index = list.findIndex((item) => item.favorite_id === favoriteId);
  if (index < 0) {
    throw new Error("Không tìm thấy mục yêu thích. (404)");
  }
  list.splice(index, 1);
  return { favorite_id: favoriteId };
}

export function countMockFavoritesByJob(jobId: string): number {
  return favorites().filter((item) => item.job_id === `${jobId || ""}`.trim()).length;
}

// ===== Tìm kiếm toàn văn =====

export function getMockSearchHits(
  q = "",
  { limit = 20 }: { limit?: number } = {},
): { hits: MockSearchHit[] } {
  const query = `${q || ""}`.trim();
  if (!query) {
    return { hits: [] };
  }
  const hits: MockSearchHit[] = [
    {
      document_id: MOCK_DOCUMENT_ID,
      job_id: MOCK_JOB_ID,
      page_idx: 0,
      block_id: "b-intro-3",
      source_snippet: `…the halogen–lithium exchange in [${query}] series was investigated…`,
      translated_snippet: `…đã khảo sát phản ứng trao đổi halogen-lithi trong chuỗi [${query}]…`,
    },
    {
      document_id: "doc-1b8c52d9a304",
      job_id: "20260520-att-001",
      page_idx: 3,
      block_id: "b-sec3-2",
      source_snippet: `…scaled dot-product attention relates to [${query}] in the encoder…`,
      translated_snippet: `…cơ chế chú ý tích vô hướng có tỉ lệ liên quan đến [${query}] trong bộ mã hóa…`,
    },
  ];
  return { hits: hits.slice(0, limit) };
}

// ===== Vùng đọc (dùng cho e2e lấy văn bản theo điểm neo/vùng chọn) =====

export function getMockReaderRegions() {
  return {
    items: [
      {
        item_id: "b-intro-3",
        region_type: "paragraph",
        status: "translated",
        source: {
          page: 1,
          bbox: [57, 52, 540, 96],
          text: "Source PDF",
        },
        translated: {
          page: 1,
          bbox: [57, 52, 540, 96],
          text: "PDF gốc",
        },
      },
      {
        item_id: "b-body-1",
        region_type: "paragraph",
        status: "translated",
        source: {
          page: 1,
          bbox: [57, 100, 540, 150],
          text: "RetainPDF Mock Preview",
        },
        translated: {
          page: 1,
          bbox: [57, 100, 540, 150],
          text: "Bản xem trước tích hợp RetainPDF",
        },
      },
    ],
  };
}
