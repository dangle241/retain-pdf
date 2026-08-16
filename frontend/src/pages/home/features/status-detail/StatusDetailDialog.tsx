// StatusDetailDialog (component chính trong thiết kế §1), đối chiếu với
// components/dialogs/status-detail-dialog-template.js và phản chiếu từng ID/class.
//
// Tầng render Dialog (đợt hai giai đoạn C, chuyển đổi shadcn): từ <dialog> native + showModal/close
// sang primitive Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content),
// không dùng giao diện mặc định của src/components/ui/dialog.jsx (className tiếp tục dùng bộ hiện có
// desktop-dialog/desktop-shell với CSS tùy chỉnh, đồng thời tồn tại cùng phần ghi đè riêng
// của status-detail-dialog). open được điều khiển bởi dialogStore (open của useStatusDetailOverview),
// onOpenChange luôn gọi dialogStore.close() khi next===false; đây không phải
// ngữ nghĩa hai trạng thái (tải lên/trạng thái) như TranslationWorkflowDialog; đóng là đóng, không cần
// phân nhánh. Escape, bấm nền sau (phát hiện outside-click của DismissableLayer), bấm nút đóng
// (DialogPrimitive.Close, thay cho thao tác đóng bằng submit ngầm trước đây của
// type="submit" trong <form method="dialog">) đều đi qua cùng callback này.
//
// Không forceMount Content (cùng quyết định với CredentialsDialog và bốn hộp thoại đợt đầu giai đoạn C,
// xem comment đầu use-dialog-return-focus.js; forceMount sẽ khiến tác dụng phụ hideOthers() bên trong
// Content của Radix modal có hiệu lực vĩnh viễn ngay khi ứng dụng khởi động).
//
// Tương tác forceMount hai tầng (điểm rủi ro của file này): bốn tab bên trong vẫn có
// TabsPrimitive.Content forceMount riêng + ghi đè hidden tường minh (quyết định giai đoạn B, xem comment hàm panel
// bên dưới để hiểu ngữ nghĩa); Dialog ngoài không còn forceMount nghĩa là khi đóng toàn bộ hộp thoại, Content
// cùng bốn Tabs bên trong sẽ unmount; useState trong tab (item được chọn của TranslationDebugTab
// và các trạng thái khác) sẽ bị xóa. Điều này chấp nhận được về ngữ nghĩa sản phẩm: việc mount thường trực bằng forceMount+hidden
// vốn chỉ phục vụ "không mất trạng thái khi đổi tab trong lúc hộp thoại mở", chưa bao giờ cam kết "đóng hộp thoại
// rồi mở lại vẫn giữ nguyên"; hai điều không xung đột (đã kiểm tra bằng phiên Playwright mới: chuyển qua bốn
// tab khi đang mở và trạng thái chọn trong gỡ lỗi bản dịch được giữ qua chuyển tab; xem báo cáo giai đoạn C).
//
// Triển khai Tabs (giai đoạn B, chuyển đổi shadcn): cùng lựa chọn với SettingsHubDialog/CredentialsDialog,
// dùng trực tiếp primitive Tabs của radix-ui (không qua giao diện mặc định của src/components/ui/tabs.jsx
// để tránh xung đột với CSS tùy chỉnh detail-tabs/detail-tab-panel). activeTab
// do controller.activateDetailTab của useStatusDetailOverview điều khiển; Radix chạy ở
// chế độ có kiểm soát. Cả bốn panel chuyển thành TabsPrimitive.Content (forceMount + ghi đè hidden
// tường minh); đã xác minh forceMount của Radix chỉ đảm bảo "buộc render children", còn khả năng hiển thị vẫn do
// hidden truyền tường minh trong contentProps quyết định (được trải sau hidden do Radix tính nội bộ,
// nên sẽ ghi đè nó); useState nội bộ của StageHistoryList/EventsList/TranslationDebugTab
// vì vậy tiếp tục không bị ảnh hưởng khi đổi tab. Đây là rủi ro lớn nhất khi di chuyển file này và đã được xác minh bằng kiểm thử component +
// phiên Playwright mới (xem status-detail-dialog-component.test.mjs và báo cáo giai đoạn B/C
// ).

import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { StageHistoryList } from "./StageHistoryList.jsx";
import { EventsList, eventsStatusText } from "./EventsList.jsx";
import { TranslationDebugTab } from "./TranslationDebugTab.jsx";
import { ManualTranslationImport } from "./ManualTranslationImport.jsx";
import { useStatusDetailOverview } from "./useStatusDetailOverview.js";
import { useRerunAction } from "./useRerunAction.js";
import { STATUS_DETAIL_DIALOG_IDS, STATUS_DETAIL_MARKDOWN_BUNDLE_ID } from "./status-detail-dom-ids.js";
import { useHomeServices } from "../../home-services-context.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useArtifactDownloadBusy } from "../../state/use-artifact-download-busy.js";
import { Button } from "../../../../components/Button.jsx";

const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "failure", label: "Thất bại" },
  { key: "events", label: "Sự kiện" },
  { key: "translation", label: "Chẩn đoán nâng cao", advanced: true },
];

function DetailItem({ id, label, value, optional = false }) {
  // Hàng optional giữ nguyên ngữ nghĩa của view.js#toggleOptionalRuntimeRow trong hệ thống cũ: phần tử luôn nằm trong
  // DOM, chỉ thêm lớp hidden cho container khi giá trị rỗng/"-" (không unmount cả hàng); lastTransition/
  // terminalReason là hai nơi duy nhất dùng ngữ nghĩa này.
  const text = `${value ?? "-"}`.trim();
  const rowHidden = optional && (!text || text === "-");
  return (
    <div className={`detail-item${rowHidden ? " hidden" : ""}`}><span className="label">{label}</span><span id={id} className="info-value">{value}</span></div>
  );
}

function OverviewMarkdownBundleLink() {
  // Miền artifact-downloads (thiết kế §7): trạng thái tải xuống đến từ statusCardStore (cùng
  // sản phẩm của điểm inject callback renderJob với ResultActions.jsx; khi status-detail mở,
  // nó luôn hiển thị cùng tác vụ đang được polling; xem chi tiết khối lắp ráp "miền StatusDetailDialog
  // " trong composition.js; phần fetch của chính overview (events/diagnostics/resumePlan)
  // không chứa markdownBundleUrl/Ready nên không tạo lại logic dẫn xuất). Hành vi click dùng
  // ủy quyền click cấp document (controller.js đã gắn bindEvents() trong composition.js); component này
  // không cần onClick, chỉ đăng ký busy store để điều khiển nội dung "Đang tải xuống..." (phương án hai).
  const services = useHomeServices();
  const cardSnapshot = useStoreSnapshot(services.statusCard.store);
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, STATUS_DETAIL_MARKDOWN_BUNDLE_ID);
  const ready = Boolean(cardSnapshot.snapshot?.markdownBundleReady);
  const url = cardSnapshot.snapshot?.markdownBundleUrl || "";
  const enabled = ready && Boolean(url) && !busyState.busy;
  const label = busyState.busy ? (busyState.label || "Đang tải xuống...") : "Tải ZIP Markdown";
  return (
    <a
      id={STATUS_DETAIL_MARKDOWN_BUNDLE_ID}
      className={`button-link secondary${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
    >
      {label}
    </a>
  );
}

function OverviewPanel({ overview, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const runtime = overview.runtime;
  return (
    <TabsPrimitive.Content
      value="overview"
      forceMount
      id={ids.panels.overview}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="overview"
      hidden={!active}
    >
      <div className="detail-download-row">
        <OverviewMarkdownBundleLink />
      </div>
      <div className="detail-grid">
        <DetailItem id={ids.runtime.currentStage} label="Giai đoạn hiện tại" value={runtime.currentStage} />
        <DetailItem id={ids.runtime.stageElapsed} label="Thời lượng giai đoạn hiện tại" value={runtime.stageElapsed} />
        <DetailItem id={ids.runtime.totalElapsed} label="Tổng thời lượng" value={runtime.totalElapsed} />
        <DetailItem id={ids.runtime.retryCount} label="Số lần thử lại" value={runtime.retryCount} />
        <DetailItem id={ids.runtime.lastTransition} label="Lần chuyển gần nhất" value={runtime.lastTransition} optional />
        <DetailItem id={ids.runtime.terminalReason} label="Lý do trạng thái cuối" value={runtime.terminalReason} optional />
        <DetailItem id={ids.runtime.inputProtocol} label="Giao thức đầu vào" value={runtime.inputProtocol} />
        <DetailItem id={ids.runtime.stageSpecVersion} label="Stage Schema" value={runtime.stageSpecVersion} />
        <DetailItem id={ids.runtime.mathMode} label="Chế độ công thức" value={runtime.mathMode} />
      </div>
      <div className="status-panel detail-stage-panel">
        <div className="status-panel-head"><h3>Dòng thời gian xử lý</h3></div>
        <StageHistoryList job={overview.job} finishedAtFallback={overview.finishedAtFallback} />
      </div>
    </TabsPrimitive.Content>
  );
}

function FailurePanel({ overview, rerunPending, controller, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const failure = overview.failure;
  const rerun = useRerunAction({ overview, rerunPending, controller });
  return (
    <TabsPrimitive.Content
      value="failure"
      forceMount
      id={ids.panels.failure}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="failure"
      hidden={!active}
    >
      <div className="status-panel">
        <div className="status-panel-head">
          <h3>Chẩn đoán lỗi</h3>
          <span className="status-panel-note">Tóm tắt lỗi có cấu trúc và đề xuất khắc phục</span>
        </div>
        <div className="failure-action-row">
          <button id={ids.failure.rerunButton} type="button" className="button-link secondary" disabled={rerun.disabled} onClick={rerun.run}>Tiếp tục từ điểm dừng / Chạy lại</button>
          <span id={ids.failure.rerunStatus} className="status-panel-note">{rerun.status || "Sau khi thất bại, nếu backend cho phép, có thể tạo tác vụ khôi phục từ đầu ra hiện có."}</span>
        </div>
        <div className="failure-hero-card">
          <span className="label">Tóm tắt lỗi</span>
          <span id={ids.failure.summary} className="info-value">{failure.summary}</span>
        </div>
        <div className="info-list detail-info-list">
          <div className="info-row"><span className="label">Phân loại</span><span id={ids.failure.category} className="info-value">{failure.category}</span></div>
          <div className="info-row"><span className="label">Giai đoạn</span><span id={ids.failure.stage} className="info-value">{failure.stage}</span></div>
          <div className="info-row"><span className="label">Nguyên nhân gốc</span><span id={ids.failure.rootCause} className="info-value">{failure.rootCause}</span></div>
          <div className="info-row"><span className="label">Đề xuất</span><span id={ids.failure.suggestion} className="info-value">{failure.suggestion}</span></div>
          <div className="info-row"><span className="label">Nhật ký gần nhất</span><span id={ids.failure.lastLogLine} className="info-value">{failure.lastLogLine}</span></div>
          <div className="info-row"><span className="label">Có thể thử lại</span><span id={ids.failure.retryable} className="info-value">{failure.retryable}</span></div>
        </div>
      </div>
    </TabsPrimitive.Content>
  );
}

function EventsPanel({ overview, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  return (
    <TabsPrimitive.Content
      value="events"
      forceMount
      id={ids.panels.events}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="events"
      hidden={!active}
    >
      <div className="status-panel">
        <div className="status-panel-head">
          <h3>Luồng sự kiện</h3>
          <span id={ids.events.status} className="status-panel-note">{eventsStatusText(overview.eventsPayload)}</span>
        </div>
        <p className="events-lead">Hiển thị sự kiện gần đây theo thứ tự thời gian giảm dần để xác định tác vụ bị kẹt ở giai đoạn nào và điều gì xảy ra trước lỗi gần nhất.</p>
        <EventsList eventsPayload={overview.eventsPayload} />
      </div>
    </TabsPrimitive.Content>
  );
}

function TranslationPanel({ overview, translation, controller, active }) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  return (
    <TabsPrimitive.Content
      value="translation"
      forceMount
      id={ids.panels.translation}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel="translation"
      hidden={!active}
    >
      <ManualTranslationImport
        jobId={overview.headline.jobId}
        onImported={() => controller.ensureTranslationData?.({ force: true })}
        onRender={() => controller.renderManualTranslation?.()}
      />
      <TranslationDebugTab translation={translation} controller={controller} />
    </TabsPrimitive.Content>
  );
}

export function StatusDetailDialog() {
  const { open, activeTab, overview, translation, rerunPending, controller, dialogStore } = useStatusDetailOverview();
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Escape / bấm nền sau (phát hiện outside-click của DismissableLayer) / nút đóng
  // (DialogPrimitive.Close) đều ghi lại store qua cùng callback; đây không phải
  // ngữ nghĩa hai trạng thái như TranslationWorkflowDialog, next===false chỉ cần gọi close().
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const headline = overview.headline;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="status-detail-dialog-overlay" />
        <DialogPrimitive.Content
          id={ids.dialog}
          className="desktop-dialog status-detail-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <div className="status-detail-headline">
                <span
                  id={ids.headline.icon}
                  className="status-detail-head-icon"
                  aria-hidden="true"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: headline.iconMarkup || "" }}
                />
                <div className="status-detail-head-copy">
                  <div className="status-detail-head-top">
                    <DialogPrimitive.Title asChild>
                      <h2>Chi tiết tác vụ</h2>
                    </DialogPrimitive.Title>
                    <p className="status-detail-job-meta">Job ID <span id={ids.headline.jobId} className="status-detail-job-id mono">{headline.jobId}</span></p>
                  </div>
                  <p id={ids.headline.note} className="status-panel-note">{headline.note}</p>
                </div>
              </div>
              <DialogPrimitive.Close asChild>
                <Button size={undefined} id={ids.headline.closeButton} className="dialog-close-btn" aria-label="Đóng">×</Button>
              </DialogPrimitive.Close>
            </div>
            <TabsPrimitive.Root
              className="contents"
              value={activeTab}
              onValueChange={(tab) => controller.activateDetailTab(tab)}
            >
              <div className="desktop-body status-detail-body">
                <TabsPrimitive.List className="detail-tabs" aria-label="Chi tiết tác vụ">
                  {TABS.map((tab) => (
                    <TabsPrimitive.Trigger
                      key={tab.key}
                      value={tab.key}
                      id={ids.tabs[tab.key]}
                      className={`detail-tab${tab.advanced ? " detail-tab-advanced" : ""}${activeTab === tab.key ? " is-active" : ""}`}
                      data-tab={tab.key}
                    >
                      {tab.label}
                    </TabsPrimitive.Trigger>
                  ))}
                </TabsPrimitive.List>

                <div className="detail-tab-panels">
                  <OverviewPanel overview={overview} active={activeTab === "overview"} />
                  <FailurePanel overview={overview} rerunPending={rerunPending} controller={controller} active={activeTab === "failure"} />
                  <EventsPanel overview={overview} active={activeTab === "events"} />
                  <TranslationPanel overview={overview} translation={translation} controller={controller} active={activeTab === "translation"} />
                </div>
              </div>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
