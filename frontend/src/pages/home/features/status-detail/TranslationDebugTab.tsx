// Translation debug tab (Advanced Diagnostics) — composes Summary/FilterPanel/ItemsPanel/DetailPanel,
// with outer status/empty/content three-state toggle, JSX rewrite of
// status-detail-dialog-translation.js#renderTranslationSummary hidden branch
// (blueprint §1.2 component table: TranslationDebugTab family).

import { TranslationSummary } from "./TranslationSummary.jsx";
import { TranslationFilterPanel } from "./TranslationFilterPanel.jsx";
import { TranslationItemsPanel } from "./TranslationItemsPanel.jsx";
import { TranslationItemDetailPanel } from "./TranslationItemDetailPanel.jsx";
import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";

export function TranslationDebugTab({ translation, controller }) {
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;
  const hidden = Boolean(translation.emptyMessage);

  return (
    <section className="status-panel translation-debug-panel">
      <div className="status-panel-head">
        <h3>Translation Debug</h3>
        <span id={ids.debugStatus} className="status-panel-note">
          {hidden ? "No translation debug data" : "Inspect per-item reasons for missing translation or retained source text"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {translation.emptyMessage || "No translation debug data"}
      </div>
      <div id={ids.debugContent} className={hidden ? "translation-debug-content hidden" : "translation-debug-content"}>
        <TranslationSummary translation={translation} />
        <TranslationFilterPanel query={translation.query} onApply={controller.applyTranslationFilter} />
        <div className="translation-debug-layout">
          <TranslationItemsPanel
            translation={translation}
            onSelect={controller.selectTranslationItem}
            onChangePage={controller.changeTranslationPage}
          />
          <TranslationItemDetailPanel translation={translation} onReplay={controller.replayCurrentItem} />
        </div>
      </div>
    </section>
  );
}



