import { API_PREFIX } from "../config/api-constants.js";
import { fetchDocumentByJobId } from "../api/documents.js";
import { createFavorite, deleteFavorite, fetchFavorites } from "../api/favorites.js";
import type {
  CreateServerFavoritesPortOptions,
  FavoriteItem,
  SelectionQuote,
  ServerFavorite,
  ServerFavoriteRaw,
} from "./types.js";

// Mục đã lưu máy chủ → bản ghi view trình đọc: snake_case sang camelCase,
// page_idx và pageIdx của jumpToReaderAnchor đều gốc 0.
// Bỏ ngay dữ liệu bẩn thiếu favorite_id hoặc quote_text bằng cách trả null.
export function normalizeServerFavorite(raw: ServerFavoriteRaw = {}): ServerFavorite | null {
  const favoriteId = `${raw?.favorite_id || ""}`.trim();
  const quoteText = `${raw?.quote_text || ""}`.trim();
  if (!favoriteId || !quoteText) {
    return null;
  }
  const pageIdx = Number(raw.page_idx);
  return {
    favoriteId,
    documentId: `${raw.document_id || ""}`.trim(),
    jobId: `${raw.job_id || ""}`.trim(),
    pageIdx: Number.isFinite(pageIdx) && pageIdx >= 0 ? pageIdx : 0,
    blockId: `${raw.block_id || ""}`.trim(),
    kind: `${raw.kind || ""}`.trim() || "sentence",
    quoteText,
    translatedQuoteText: `${raw.translated_quote_text || ""}`.trim(),
    note: `${raw.note || ""}`.trim(),
    createdAt: `${raw.created_at || ""}`.trim(),
  };
}

// Bản ghi cục bộ mang serverFavoriteId sau khi đồng bộ thành công; vùng đám mây không hiển thị lặp các mục này.
export function dedupeServerFavorites(
  serverFavorites: ServerFavorite[] = [],
  localItems: FavoriteItem[] = [],
): ServerFavorite[] {
  const syncedIds = new Set(
    (Array.isArray(localItems) ? localItems : [])
      .map((item) => `${item?.serverFavoriteId || ""}`.trim())
      .filter(Boolean),
  );
  return (Array.isArray(serverFavorites) ? serverFavorites : [])
    .filter((favorite) => favorite?.favoriteId && !syncedIds.has(favorite.favoriteId));
}

// Đồng bộ mục đã lưu của trình đọc tới favorites backend.
// Tra trực tiếp document_id qua backend GET /documents?job_id= (gồm run lịch sử); frontend không quét danh sách để tra ngược nữa.
// Mọi lệnh gọi máy chủ đều cố gắng tối đa; lỗi chỉ ghi log, tính năng cục bộ của trình đọc không bị ảnh hưởng.
export function createReaderServerFavoritesPort({
  jobId = "",
  apiPrefix = API_PREFIX,
  documentByJobId = fetchDocumentByJobId,
  submitFavorite = createFavorite,
  loadFavorites = fetchFavorites,
  removeFavorite = deleteFavorite,
}: CreateServerFavoritesPortOptions = {}) {
  let documentIdPromise: Promise<string> | null = null;

  function resolveDocumentId() {
    if (!documentIdPromise) {
      documentIdPromise = (async () => {
        try {
          const document = await documentByJobId(apiPrefix, jobId);
          return `${document?.document_id || ""}`.trim();
        } catch (_err) {
          return "";
        }
      })();
    }
    return documentIdPromise;
  }

  async function syncFavorite(quote: SelectionQuote = {}) {
    const blockId = `${quote.blockId || ""}`.trim();
    const quoteText = `${quote.quoteText || ""}`.trim();
    if (!blockId || !quoteText) {
      return null;
    }
    try {
      // Luồng ghi chỉ gửi job_id; backend phân giải tài liệu tương ứng, kể cả run lịch sử cũng lưu được.
      const favorite = await submitFavorite(apiPrefix, {
        job_id: jobId,
        page_idx: Number(quote.pageIdx) || 0,
        block_id: blockId,
        quote_text: quoteText,
        translated_quote_text: `${quote.translatedQuoteText || ""}`,
        kind: "sentence",
      });
      console.info("Mục đã lưu đã được đồng bộ lên máy chủ", favorite?.favorite_id || "");
      return favorite;
    } catch (error) {
      console.error("Không thể đồng bộ mục đã lưu lên máy chủ", error);
      return null;
    }
  }

  // Lấy và chuẩn hóa mục đã lưu máy chủ của tài liệu hiện tại; khi offline/không phân giải được tài liệu thì âm thầm trả rỗng.
  // Chế độ mock không đi tắt: lớp api có nhánh mock; đường cơ sở và e2e cần toàn luồng mock hoạt động.
  async function loadServerFavorites(): Promise<ServerFavorite[]> {
    const documentId = await resolveDocumentId();
    if (!documentId) {
      return [];
    }
    try {
      const { favorites = [] } = await loadFavorites(apiPrefix, { documentId });
      return (Array.isArray(favorites) ? favorites : [])
        .map(normalizeServerFavorite)
        .filter(Boolean);
    } catch (error) {
      console.warn("Không thể tải mục đã lưu từ máy chủ", error);
      return [];
    }
  }

  // Xóa mục đã lưu trên máy chủ; thành công trả true, lỗi chỉ ghi log và trả false để không chặn luồng cục bộ.
  async function removeServerFavorite(favoriteId: string) {
    const normalized = `${favoriteId || ""}`.trim();
    if (!normalized) {
      return false;
    }
    try {
      await removeFavorite(apiPrefix, normalized);
      return true;
    } catch (error) {
      console.error("Không thể xóa mục đã lưu trên máy chủ", error);
      return false;
    }
  }

  // Đặc tả không có PATCH cho mục đã lưu: sửa ghi chú = tạo lại cùng điểm neo + xóa cũ. Tạo trước xóa sau để không mất dữ liệu khi lỗi.
  // Luồng ghi chỉ gửi job_id; backend phân giải tài liệu tương ứng.
  async function recreateFavoriteNote(annotation: Partial<ServerFavorite> = {}, note = "") {
    if (!annotation?.favoriteId) {
      return null;
    }
    try {
      const created = await submitFavorite(apiPrefix, {
        job_id: `${annotation.jobId || jobId || ""}`.trim() || undefined,
        page_idx: Number(annotation.pageIdx) || 0,
        block_id: `${annotation.blockId || ""}`.trim(),
        quote_text: `${annotation.quoteText || ""}`,
        translated_quote_text: `${annotation.translatedQuoteText || ""}`,
        kind: `${annotation.kind || "sentence"}`,
        note: `${note || ""}`,
      });
      await removeServerFavorite(annotation.favoriteId);
      return normalizeServerFavorite(created);
    } catch (error) {
      console.error("Không thể cập nhật ghi chú chú thích", error);
      return null;
    }
  }

  return Object.freeze({
    loadServerFavorites,
    recreateFavoriteNote,
    removeServerFavorite,
    resolveDocumentId,
    syncFavorite,
  });
}
