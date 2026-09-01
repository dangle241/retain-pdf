// Translation调试 tab(Advanced Diagnostics)——组合 Summary/FilterPanel/ItemsPanel/DetailPanel,
// 外层 status/empty/content 三态切换 JSX 重写
// status-detail-dialog-translation.js#renderTranslationSummary 的 hidden branch
// (蓝图 §1.2 组件表:TranslationDebugTab 家族).

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
          {hidden ? "No Translation调试Data" : "按 item 排查为什么没Translation, 为什么Source retained"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {translation.emptyMessage || "No Translation调试Data"}
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




