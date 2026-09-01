// Excerpt悬浮窗: CurrentDocuments的服务端FavoriteList(对齐 legacy 云端区)

import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import {
  API_PREFIX,
  createReaderServerFavoritesPort,
  fetchFavorites,
  normalizeServerFavorite,
  type ServerFavorite,
} from "../../external.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";

export type ReaderFavoritesPanelProps = {
  open: boolean;
  jobId: string;
  documentId: string;
  onClose: () => void;
  /** 1-based page jump */
  onJumpPage: (page: number) => void;
};

function kindLabel(kind: string) {
  const k = `${kind || ""}`.trim();
  if (k === "figure") return "Figure";
  if (k === "data") return "Data";
  if (k === "sentence") return "Excerpt";
  return k || "Excerpt";
}

export function ReaderFavoritesPanel({
  open,
  jobId,
  documentId,
  onClose,
  onJumpPage,
}: ReaderFavoritesPanelProps) {
  const [items, setItems] = useState<ServerFavorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!jobId && !documentId) {
      setItems([]);
      setError("Current没有可关联的Documents");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let list: ServerFavorite[] = [];
      if (jobId) {
        const port = createReaderServerFavoritesPort({ jobId });
        list = await port.loadServerFavorites();
      } else if (documentId) {
        const { favorites = [] } = await fetchFavorites(API_PREFIX, { documentId });
        list = (Array.isArray(favorites) ? favorites : [])
          .map((raw) => normalizeServerFavorite(raw))
          .filter(Boolean) as ServerFavorite[];
      }
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取ExcerptFailed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [jobId, documentId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  return (
    <ReaderFloatShell
      id="reader-favorites-panel"
      open={open}
      title="Excerpt"
      subtitle="books书Cloud favorites · books地Save"
      titleIcon={<Bookmark size={14} strokeWidth={2.25} aria-hidden />}
      storageKey="retainpdf.reader.favorites-float.pos.v1"
      ariaLabel="Excerpt"
      onClose={onClose}
      toolbar={(
        <>
          <span className="reader-notes-count">
            {loading ? "Loading..." : `${items.length} entries`}
          </span>
          <button
            type="button"
            className="reader-notes-export"
            disabled={loading}
            onClick={() => void reload()}
          >
            刷新
          </button>
        </>
      )}
    >
      {error ? (
        <p className="reader-notes-empty" role="alert">{error}</p>
      ) : loading ? (
        <p className="reader-notes-empty">正在加载Excerpt...</p>
      ) : items.length === 0 ? (
        <p className="reader-notes-empty">
          No Excerpt.在阅读时选中文字添加annotations, 或从主pagesFavorite跳转过来.
        </p>
      ) : (
        items.map((item) => (
          <article key={item.favoriteId} className="reader-notes-item">
            <div className="reader-notes-item-top">
              <span className="reader-notes-kind">{kindLabel(item.kind)}</span>
              <div className="reader-notes-item-actions">
                <button
                  type="button"
                  className="reader-notes-link"
                  onClick={() => onJumpPage(Math.max(1, (item.pageIdx || 0) + 1))}
                >
                  Page {(item.pageIdx || 0) + 1} pages
                </button>
              </div>
            </div>
            <p className="reader-notes-quote">{item.quoteText}</p>
            {item.note ? <p className="reader-notes-note" style={{ cursor: "default" }}>{item.note}</p> : null}
          </article>
        ))
      )}
    </ReaderFloatShell>
  );
}




