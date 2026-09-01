// Artifact list card + Markdown Preview card.
//
// #detail-artifacts-summary / #detail-artifacts-list and
// #detail-markdown-image-grid / #detail-markdown-image-empty are "Imperative silos":
// Content retained from legacy module. src/js/job-detail/artifacts.js (via overview-renderer.js /
// markdown-flow.js)after data load innerHTML / classList Write.React Sidebar-only render
// Legacy detail.html Consistent static initial skeleton,Virtual DOM Immutable,re-renders will not
// override imperative writes. Markdown Card remaining text fields use setText adaptation (React state).

import { memo } from "react";
import { MetaRow } from "./JobSummaryCard.jsx";

export const ArtifactsSection = memo(function ArtifactsSection() {
  return (
    <article className="detail-card">
      <div className="detail-trigger-head">
        <h2>Artifacts</h2>
        <span id="detail-artifacts-summary" className="detail-inline-note">Not loaded</span>
      </div>
      <div id="detail-artifacts-list" className="detail-artifact-list">
<div className="detail-empty">No artifacts list available</div>
      </div>
    </article>
  );
});

const MarkdownImageIsland = memo(function MarkdownImageIsland() {
  return (
    <>
      <div id="detail-markdown-image-grid" className="detail-markdown-image-grid hidden"></div>
      <div id="detail-markdown-image-empty" className="detail-empty">None Markdown Image Reference</div>
    </>
  );
});

export function MarkdownCard({ t }) {
  return (
    <article className="detail-card">
      <div className="detail-trigger-head">
<h2>Markdown Preview</h2>
        <span id="detail-markdown-status" className="detail-inline-note">{t("detail-markdown-status", "Not requested")}</span>
      </div>
      <div className="detail-meta-list">
        <MetaRow label="JSON API" id="detail-markdown-json-url" mono value={t("detail-markdown-json-url")} />
<MetaRow label="Raw API" id="detail-markdown-raw-url" mono value={t("detail-markdown-raw-url")} />
        <MetaRow label="Images Base URL" id="detail-markdown-images-base-url" mono value={t("detail-markdown-images-base-url")} />
        <MetaRow label="Image reference count" id="detail-markdown-image-count" value={t("detail-markdown-image-count")} />
      </div>
      <MarkdownImageIsland />
      <pre id="detail-markdown-preview" className="detail-log">{t("detail-markdown-preview")}</pre>
    </article>
  );
}
