// Artifact Manifest卡片 + Markdown 预览卡片.
//
// #detail-artifacts-summary / #detail-artifacts-list 与
// #detail-markdown-image-grid / #detail-markdown-image-empty yes"命令式孤岛":
// 内容由保留的旧模块 src/js/job-detail/artifacts.js(经 overview-renderer.js /
// markdown-flow.js)在Data加载后以 innerHTML / classList 写入.React 侧只Rendering
// 与旧 detail.html 一致的静态初始骨架,且虚拟 DOM 恒定不变,重Rendering不会
// 覆盖命令式写入.Markdown 卡片其余文books字段走 setText 适配(React state).

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
      <div id="detail-markdown-image-empty" className="detail-empty">No  Markdown 图片引用</div>
    </>
  );
});

export function MarkdownCard({ t }) {
  return (
    <article className="detail-card">
      <div className="detail-trigger-head">
        <h2>Markdown 预览</h2>
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




