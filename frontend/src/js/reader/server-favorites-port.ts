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

// Server favorite → Reader view record: snake_case to camelCase,
// page_idx is 0-based, matching jumpToReaderAnchor pageIdx.
// Drop dirty data lacking favorite_id or quote_text (return null).
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

// Local records carry serverFavoriteId after sync; avoid re-displaying them in cloud section.
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

// Sync Reader favorite to backend favorites.
// document_id resolved via backend GET /documents?job_id= (includes history runs); frontend no longer scans list.
// All server calls best-effort: failures only logged, local Reader tools unaffected.
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
      // Write path only sends job_id; backend resolves owning document (history runs favoritable too)
      const favorite = await submitFavorite(apiPrefix, {
        job_id: jobId,
        page_idx: Number(quote.pageIdx) || 0,
        block_id: blockId,
        quote_text: quoteText,
        translated_quote_text: `${quote.translatedQuoteText || ""}`,
        kind: "sentence",
      });
      console.info("Favorite synced to server", favorite?.favorite_id || "");
      return favorite;
    } catch (error) {
      console.error("syncFavorite to server failed", error);
      return null;
    }
  }

  // Pull current document's server favorites and normalize; silently return empty on offline/unresolvable document.
// mock mode not short-circuited: API layer provides mock branch, baseline/e2e rely on full mock workflow.
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

  // Delete server favorite, returns true on success; failures only logged and return false (does not block local workflow).
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

  // Spec has no favorite PATCH: editing note = recreate at same anchor + delete old. Create then delete; failure loses no data.
// Write path only sends job_id; backend resolves owning document.
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
      console.error("Update annotation note failed", error);
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




