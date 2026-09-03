// Artifact Manifest card + Markdown preview card.
//
// #detail-artifacts-summary / #detail-artifacts-list and
// #detail-markdown-image-grid / #detail-markdown-image-empty are "imperative islands":
// their content is written via innerHTML / classList by the retained legacy modules
// src/js/job-detail/artifacts.js (via overview-renderer.js / markdown-flow.js) after
// data load. The React side only renders the static initial skeleton that matches
// the old detail.html, and the virtual DOM is immutable, so re-renders will not
// overwrite the imperative writes. Other Markdown card text fields go through the
// setText adapter (React state).

import { memo } from "react";
import { MetaRow } from "./JobSummaryCard.jsx";

export const ArtifactsSection = memo(function ArtifactsSection() {
  return (
    <article className="detail-card">
      <div className="detail-trigger-head">
        <h2>Artifact Manifest</h2>
        <span id="detail-artifacts-summary" className="detail-inline-note">Not loaded yet</span>
      </div>
      <div id="detail-artifacts-list" className="detail-artifact-list">
        <div className="detail-empty">No Artifact Manifest</div>
      </div>
    </article>
  );
});

const MarkdownImageIsland = memo(function MarkdownImageIsland() {
  return (
    <>
      <div id="detail-markdown-image-grid" className="detail-markdown-image-grid hidden"></div>
      <div id="detail-markdown-image-empty" className="detail-empty">No Markdown image references</div>
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
        <MetaRow label="Image References" id="detail-markdown-image-count" value={t("detail-markdown-image-count")} />
      </div>
      <MarkdownImageIsland />
      <pre id="detail-markdown-preview" className="detail-log">{t("detail-markdown-preview")}</pre>
    </article>
  );
}




