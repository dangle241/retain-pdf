// "Book overview" tab — title / authors / tags / edit + metadata grid.
// Changes to overview UI only need to touch this file (or TitleMetaPanel).
// Metadata (pages/size/added/collection) moved out of the left column so the
// right column is no longer empty, while the left column is pure cover + primary
// action.

import { IconLayers } from "../panels/ui.jsx";
import { TitleMetaPanel } from "../panels/TitleMetaPanel.jsx";

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function MetaCell({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * @param {object} props TitleMetaPanel business props + metadata (pageCount/bytes/addedAt/memberCollections)
 */
export function BookDetailOverviewTab({
  pageCount,
  bytes,
  addedAt,
  memberCollections = [],
  ...titleMetaProps
}) {
  const sizeText = formatBytes(bytes);
  const dateText = formatDate(addedAt);
  return (
    <div
      className="book-detail-tab-overview space-y-5"
      data-book-detail-tab="overview"
    >
      <TitleMetaPanel {...titleMetaProps} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border/60 p-4 sm:grid-cols-4">
        <MetaCell label="Pages">{pageCount ? `${pageCount} pages` : "—"}</MetaCell>
        <MetaCell label="Size">{sizeText || "—"}</MetaCell>
        <MetaCell label="Added">{dateText || "—"}</MetaCell>
        <MetaCell label="Collection">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <IconLayers className="shrink-0 text-muted-foreground" />
            <span className="truncate">
              {memberCollections.length ? memberCollections.join(", ") : "Not added"}
            </span>
          </span>
        </MetaCell>
      </dl>
    </div>
  );
}



