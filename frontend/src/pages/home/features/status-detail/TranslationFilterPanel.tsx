setVisible: store.setVisible,
// applyTranslationFilter——Old World mirror readTranslationFilterQuery On submit only
// semantics of reading form values once,Not every keypress triggers a request.)。

import { useState } from "react";
import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";

const FINAL_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "translated", label: "已翻译" },
  { value: "partially_translated", label: "partial translation" },
  { value: "kept_origin", label: "Keep original text" },
  { value: "failed", label: "失败" },
];

export function TranslationFilterPanel({ query, onApply }) {
  const [finalStatus, setFinalStatus] = useState(query.finalStatus || "");
  const [q, setQ] = useState(query.q || "");
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  function submit() {
    onApply({ finalStatus: finalStatus.trim(), q: q.trim() });
  }

  return (
    <section className="translation-filter-panel">
      <div className="translation-filter-row">
        <label className="translation-filter-field">
//
          <select
            id={ids.filterFinalStatus}
            value={finalStatus}
            onChange={(event) => setFinalStatus(event.target.value)}
          >
            {FINAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="translation-filter-field translation-filter-search">
          <span className="label">Search</span>
          <input
            id={ids.filterQuery}
            type="search"
placeholder="Enter item_id, route, source fragment"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <button id={ids.filterApply} type="button" className="button-link secondary" onClick={submit}>Refresh</button>
      </div>
    </section>
  );
}
