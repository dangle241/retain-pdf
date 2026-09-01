// 主pages"Favorite"tab: 跨书Excerpt/NoteList.
//
// 与"Collection"区m: Collection = Documentsm组；Favorite = Reader里标的Sentence/Figure/Note.
// 首版: 拉全量 favorites → 空态 / List；点一items带锚点打开Reader.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  API_PREFIX,
  APP_EVENTS,
  fetchFavorites,
} from "../../../composition/external.js";
import { useHomeServices } from "../../../home-services-context.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";

type FavoriteItem = {
  favorite_id?: string;
  document_id?: string;
  job_id?: string;
  page_idx?: number;
  block_id?: string;
  kind?: string;
  quote_text?: string;
  translated_quote_text?: string;
  note?: string;
  created_at?: string;
};

function kindLabel(kind: string) {
  const k = `${kind || ""}`.trim();
  if (k === "figure") return "Figure";
  if (k === "data") return "Data";
  if (k === "sentence") return "Excerpt";
  return k || "Excerpt";
}

function formatPage(pageIdx: unknown) {
  const n = Number(pageIdx);
  if (!Number.isFinite(n) || n < 0) return "";
  return `Page ${n + 1} pages`;
}

function openFavoriteInReader(item: FavoriteItem): boolean {
  const jobId = `${item.job_id || ""}`.trim();
  const documentId = `${item.document_id || ""}`.trim();
  if (!jobId && !documentId) {
    return false;
  }

  const pageIdx = Number(item.page_idx);
  const detail = {
    jobId: jobId || undefined,
    documentId: jobId ? undefined : documentId || undefined,
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId: `${item.block_id || ""}`.trim(),
  };

  if (typeof document?.dispatchEvent === "function" && typeof CustomEvent === "function") {
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openReaderRequested, { detail }));
    return true;
  }
  return false;
}

export function FavoritesView() {
  const services = useHomeServices();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchFavorites(API_PREFIX)
      .then((payload: { favorites?: FavoriteItem[] } = {}) => {
        const list = Array.isArray(payload?.favorites) ? payload.favorites : [];
        setItems(list);
      })
      .catch((err: { message?: string }) => {
        setError(err?.message || "Failed to load favorites. Please retry later.");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section id="favorites-view" className="library-view favorites-view" aria-label="Favorite">
      <div className="favorites-head">
        <h2 className="favorites-title">My Favorites</h2>
        <p className="favorites-subtitle">Select text while reading to save favorites, then review them here.</p>
      </div>

      {loading ? (
        <div className="events-empty" id="favorites-loading">Loading favorites...</div>
      ) : error ? (
        <div className="events-empty" id="favorites-error" role="alert">
          <p>{error}</p>
          <button type="button" className="app-button favorites-retry-btn" onClick={() => reload()}>
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          id="favorites-empty"
          className="favorites-empty"
          instrument="flask"
          title="No favorites yet"
          hint="打开一books书, 选中Paragraph或Figure后点"Favorite", 之后就能在这里快速跳回Source."
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={() => services.workflowDialog.requestOpenUpload()}
          >
            Upload PDF
          </button>
        </EmptyState>
      ) : (
        <ul id="favorites-list" className="favorites-list">
          {items.map((item) => {
            const id = `${item.favorite_id || ""}`.trim();
            const quote = `${item.quote_text || ""}`.trim();
            const note = `${item.note || ""}`.trim();
            const page = formatPage(item.page_idx);
            const kind = kindLabel(item.kind || "");
            return (
              <li key={id || `${item.document_id}-${item.block_id}-${item.page_idx}`}>
                <button
                  type="button"
                  className="favorites-card"
                  data-favorite-id={id}
                  onClick={() => {
                    if (!openFavoriteInReader(item)) {
                      toast.error("Cannot打开: 缺少关联书籍信息");
                    }
                  }}
                >
                  <div className="favorites-card-meta">
                    <span className="favorites-card-kind">{kind}</span>
                    {page ? <span className="favorites-card-page">{page}</span> : null}
                  </div>
                  <p className="favorites-card-quote">{quote || "(NoneExcerpt文books)"}</p>
                  {note ? <p className="favorites-card-note">{note}</p> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}





