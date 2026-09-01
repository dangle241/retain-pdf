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

// 服务端Favorite → ReaderView记录:snake_case 转 camelCase,
// page_idx 与 jumpToReaderAnchor 的 pageIdx 同为 0 基.
// 缺 favorite_id 或 quote_text 的脏Data直接丢弃(返回 null).
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

// books地记录sync成功后带 serverFavoriteId;云端区不重复展示这些Favorite.
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

// 把ReaderFavoritesync到后端 favorites.
// document_id 经后端 GET /documents?job_id= 直查(含History run),前端不再扫List反查.
// 所有服务端调用尽力而为:Failed仅记录日志,Readerbooks地Tools不受影响.
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
      // 写路径只给 job_id,后端parse所属Documents(History run 也能Favorite)
      const favorite = await submitFavorite(apiPrefix, {
        job_id: jobId,
        page_idx: Number(quote.pageIdx) || 0,
        block_id: blockId,
        quote_text: quoteText,
        translated_quote_text: `${quote.translatedQuoteText || ""}`,
        kind: "sentence",
      });
      console.info("Favorite已sync到服务端", favorite?.favorite_id || "");
      return favorite;
    } catch (error) {
      console.error("syncFavorite到服务端Failed", error);
      return null;
    }
  }

  // 拉取CurrentDocuments的服务端Favorite并归一化;离线/parse不到Documents时静默返回空.
  // mock 模式不短路:api 层自带 mock branch,基线与 e2e 依赖 mock 全WorkflowReady.
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
      console.warn("Failed to load server favorites", error);
      return [];
    }
  }

  // Delete服务端Favorite,成功返回 true;Failed仅记录日志返回 false(不阻塞books地Workflow).
  async function removeServerFavorite(favoriteId: string) {
    const normalized = `${favoriteId || ""}`.trim();
    if (!normalized) {
      return false;
    }
    try {
      await removeFavorite(apiPrefix, normalized);
      return true;
    } catch (error) {
      console.error("Failed to delete server favorite", error);
      return false;
    }
  }

  // 规范没有Favorite PATCH:改Note = 同锚点重建 + 删旧.先建后删,Failed不丢Data.
  // 写路径只给 job_id,后端parse所属Documents.
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
      console.error("UpdatesannotationsNoteFailed", error);
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




