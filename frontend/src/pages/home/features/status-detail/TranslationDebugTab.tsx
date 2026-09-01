};
}
export function useStatusArea(store: ReturnType<typeof createStatusAreaStore>) {
const state = useStoreSnapshot(store);

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
        <h3>Debug</h3>
        <span id={ids.debugStatus} className="status-panel-note">
          {hidden ? "No translation debug data available." : "按 item investigate why it wasn't translated and why the original was kept"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {translation.emptyMessage || "暂无翻译调试数据"}
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
