// Status card store + presenter (blueprint §2 features/status/, §4 lifecycle).
//
// logic(finalStatusCounts Override counts,Same as old world);summarizeTranslationFilter
// Only VM source: job-status/status-card-runtime-source.js's

import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import { summarizeTranslationFilter } from "../../composition/external.js";

export function TranslationSummary({ translation }) {
  const summary = translation.summary?.summary || {};
  const finalStatusCounts = summary.status_summary || summary.final_status_counts || {};
  const counts = Object.keys(finalStatusCounts || {}).length ? finalStatusCounts : (summary.counts || {});
  const providerFamily = `${summary.provider_family || summary.provider || ""}`.trim() || "-";
  const filterText = summarizeTranslationFilter(translation.query);
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  return (
    <section className="translation-summary-shell">
      <div className="translation-summary-grid">
        <div className="translation-summary-card"><span className="label">已翻译</span><span id={ids.countTranslated} className="info-value">{counts.translated ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">部分翻译</span><span id={ids.countPartiallyTranslated} className="info-value">{counts.partially_translated ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">保留原文</span><span id={ids.countKeptOrigin} className="info-value">{counts.kept_origin ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">失败</span><span id={ids.countFailed} className="info-value">{counts.failed ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">Provider</span><span id={ids.providerFamily} className="info-value">{providerFamily}</span></div>
      </div>
      <div className="translation-summary-notes">
        <span id={ids.listFilter} className="status-panel-note">{`Filter:${filterText}`}</span>
      </div>
    </section>
  );
}
