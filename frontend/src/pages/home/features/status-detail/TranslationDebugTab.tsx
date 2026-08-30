// Tab gỡ lỗi bản dịch (chẩn đoán nâng cao): tổ hợp Summary/FilterPanel/ItemsPanel/DetailPanel,
// bản viết lại JSX của chuyển đổi ba trạng thái status/empty/content ở lớp ngoài từ
// nhánh hidden trong status-detail-dialog-translation.js#renderTranslationSummary
// (bảng component thiết kế §1.2: họ TranslationDebugTab).

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
        <h3>Gỡ lỗi bản dịch</h3>
        <span id={ids.debugStatus} className="status-panel-note">
          {hidden ? "Chưa có dữ liệu gỡ lỗi bản dịch" : "Kiểm tra theo từng mục để biết vì sao chưa dịch hoặc giữ nguyên văn"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {translation.emptyMessage || "Chưa có dữ liệu gỡ lỗi bản dịch"}
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
