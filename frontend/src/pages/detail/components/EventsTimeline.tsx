// Dòng thời gian giai đoạn / luồng sự kiện: hai thẻ kích hoạt + hai modal.
// View là bản viết lại JSX từ template chuỗi src/js/job-detail/events.js, giữ nguyên tên class/cấu trúc;
// View model của mục sự kiện dùng lại status-view-model.js logic thuần và hàm định dạng lớp job/ được giữ lại.
//
// Lớp kết xuất Dialog (đợt kết thúc giai đoạn C, chuyển đổi shadcn): hai modal chuyển từ bespoke
// <section className="detail-modal"><div role="dialog" aria-modal="true">
// sang Radix Dialog (DialogPrimitive.Root/Portal/Overlay/Content), thống nhất với
// khung hình ảnh desktop-dialog/desktop-shell/desktop-head/desktop-body của trang home,
// không còn duy trì cấu trúc riêng .detail-modal/.detail-modal-panel/ của trang detail
// .detail-modal-head (CSS của ba class này đã được xóa khỏi
// src/styles/pages/detail/modal.css). detail-modal-title/-subtitle/
// -close/-status là các class thuần bố cục được giữ nguyên (điểm gắn chuyển từ con của cấu trúc cũ sang
// con của desktop-head/desktop-body; hình ảnh không đổi, nội dung không dùng chung nên không đáng thống nhất thành
// dialog-close-btn dùng chung giữa hộp thoại; đặc biệt màu viền của detail-modal-close
// #d5d7dd khác literal #d2d2d7 của dialog-close-btn; hợp nhất vội sẽ tạo khác biệt khó thấy bằng mắt
// nhưng pixelmatch có thể bắt được). Các class mới detail-timeline-dialog/
// detail-timeline-overlay tái tạo hình ảnh từng pixel của .detail-modal/.detail-modal-panel cũ
// (rộng tối đa 920px/cao tối đa 82vh/bo góc 28px/viền #e5e7eb/bóng đậm hơn),
// định nghĩa tại pages/detail/modal.css.
//
// Trạng thái open vẫn là hai useState stageHistoryOpen/eventsOpen trong DetailApp.jsx
// (quy tắc cứng: không đổi quản lý trạng thái, chỉ đổi lớp kết xuất); onOpenChange(false) được định tuyến thống nhất tới
// callback onClose để ghi lại state.
//
// Trả focus: nút kích hoạt của hai modal (StageHistoryTriggerCard/EventsTriggerCard)
// dù nằm cùng cây thành phần DetailApp với modal nhưng không dùng
// DialogPrimitive.Trigger bọc nút kích hoạt, nên triggerRef mặc định của Radix luôn là
// null; nguyên nhân này không liên quan việc "có qua cây con hay không" (xem chú thích đầu
// use-dialog-return-focus.js), vì vậy cũng dùng useDialogReturnFocus để nhất quán với 7 hộp thoại trang home,
// không giả định có thể bỏ chỉ vì "trông như trong cùng một cây".
//
// Khóa cuộn body: khóa document.body.style.overflow viết tay trước đây trong DetailApp.jsx
// đã bị xóa (xem chú thích tương ứng); chế độ modal của Radix Dialog có khóa tương đương
// (react-remove-scroll tự khóa/mở theo lúc Content gắn/gỡ); hai modal loại trừ nhau
// (khi một cái mở, overlay + focus trap làm thẻ kích hoạt cái kia không thể truy cập), nên không có
// tình huống hai cơ chế cùng tranh chấp style body.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../shared/react/use-dialog-return-focus.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  stageHistoryDisplay,
  isJobTerminal,
  buildJobDetailEventViewModel,
} from "../external.js";

// — Ba hàm riêng dưới đây được sao chép từ events.js cũ để nội dung thời lượng/payload giống từng byte —

function parseIsoTime(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveStageHistoryDuration(entry, job) {
  const explicit = Number(entry?.duration_ms);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const enterAt = parseIsoTime(entry?.enter_at);
  const exitAt = parseIsoTime(entry?.exit_at);
  if (enterAt && exitAt) {
    return Math.max(0, exitAt.getTime() - enterAt.getTime());
  }
  if (enterAt && !exitAt) {
    const endAt = isJobTerminal(job)
      ? parseIsoTime(job.finished_at || job.updated_at)
      : new Date();
    if (endAt) {
      return Math.max(0, endAt.getTime() - enterAt.getTime());
    }
  }
  return NaN;
}

function formatEventPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch (_err) {
    return "";
  }
}

export function StageHistoryTriggerCard({ onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
          <h2>Dòng thời gian giai đoạn</h2>
          <button id="detail-open-stage-history-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>Xem</button>
        </div>
        <p className="detail-trigger-copy">Mặc định thu gọn để trang không bị kéo dài. Mở khi cần xem đầy đủ lịch sử chuyển giai đoạn.</p>
      </div>
    </article>
  );
}

export function EventsTriggerCard({ buttonText, onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
          <h2>Luồng sự kiện</h2>
          <button id="detail-open-events-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>{buttonText}</button>
        </div>
        <p className="detail-trigger-copy">Mặc định không yêu cầu luồng sự kiện. Dữ liệu chỉ được tải khi bấm xem để tránh tiêu tốn quá nhiều băng thông khi mở trang chia sẻ lần đầu.</p>
      </div>
    </article>
  );
}

function DetailModal({ modalId, titleId, title, subtitle, closeButtonId, open, onClose, children }) {
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Esc / bấm nền / nút đóng đều ghi lại useState của DetailApp.jsx qua một callback này.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      onClose();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="detail-timeline-overlay" />
        <DialogPrimitive.Content
          id={modalId}
          className="desktop-dialog detail-timeline-dialog"
          aria-labelledby={titleId}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <div>
                <DialogPrimitive.Title asChild>
                  <h2 id={titleId} className="detail-modal-title">{title}</h2>
                </DialogPrimitive.Title>
                <p className="detail-modal-subtitle">{subtitle}</p>
              </div>
              <DialogPrimitive.Close asChild>
                <button id={closeButtonId} type="button" className="detail-modal-close" aria-label="Đóng">×</button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body">
              {children}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function StageHistoryItem({ entry, index, job }) {
  const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "Đang thực hiện");
  const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
  const display = stageHistoryDisplay(entry);
  return (
    <article className="detail-stage-item">
      <div className="detail-stage-top">
        <div className="detail-stage-title">{`${index + 1}. ${display.title}`}</div>
        <div className="detail-stage-title">{formatRuntimeDuration(resolveStageHistoryDuration(entry, job))}</div>
      </div>
      <div className="detail-stage-meta">{`${enterAt} → ${exitAt}${terminalText}`}</div>
    </article>
  );
}

export function StageHistoryModal({ open, job, onClose }) {
  const history = Array.isArray(job?.stage_history) ? job.stage_history : [];
  const hasItems = history.length > 0;
  return (
    <DetailModal
      modalId="detail-stage-history-modal"
      titleId="detail-stage-history-modal-title"
      title="Dòng thời gian giai đoạn"
      subtitle="Hiển thị thời điểm bắt đầu, kết thúc và thời lượng theo từng giai đoạn."
      closeButtonId="detail-close-stage-history-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-stage-history-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>Chưa có bản ghi giai đoạn</div>
      <div id="detail-stage-history-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {history.map((entry, index) => (
          <StageHistoryItem key={index} entry={entry} index={index} job={job} />
        ))}
      </div>
    </DetailModal>
  );
}

function EventItem({ item }) {
  const viewModel = buildJobDetailEventViewModel(item);
  const payloadText = formatEventPayload(viewModel.payload);
  const metaBits = [
    `#${viewModel.seq}`,
    formatEventTimestamp(viewModel.timestamp),
    viewModel.stageText,
  ];
  const contextBits = [
    viewModel.lane && viewModel.lane !== "main" ? `lane:${viewModel.lane}` : "",
    viewModel.displayStage ? `stage:${viewModel.displayStage}` : "",
    viewModel.substage ? `substage:${viewModel.substage}` : "",
    viewModel.provider,
    viewModel.providerStage,
    viewModel.eventType,
    viewModel.rawEventType,
  ].filter(Boolean);
  const statsBits = [];
  const progressCurrent = viewModel.progressCurrent;
  const progressTotal = viewModel.progressTotal;
  if (progressCurrent !== null || progressTotal !== null) {
    const progressUnit = viewModel.progressUnit;
    const suffix = progressUnit ? ` ${progressUnit}` : "";
    const text = viewModel.progressText ? `${viewModel.progressText} · ` : "";
    statsBits.push(`${text}progress ${progressCurrent ?? "-"} / ${progressTotal ?? "-"}${suffix}`);
  }
  const retryCount = viewModel.retryCount;
  if (retryCount !== null) {
    statsBits.push(`retry ${retryCount}`);
  }
  const elapsedMs = viewModel.elapsedMs;
  if (elapsedMs !== null) {
    statsBits.push(`elapsed ${formatRuntimeDuration(elapsedMs)}`);
  }
  return (
    <article className="detail-event-item">
      <div className="detail-event-top">
        <div className="detail-event-title">{viewModel.event}</div>
        <div className="detail-event-title">{viewModel.level}</div>
      </div>
      <div className="detail-event-meta">{metaBits.join(" · ")}</div>
      {contextBits.length ? <div className="detail-event-meta">{contextBits.join(" · ")}</div> : null}
      <div className="detail-event-meta">{viewModel.message}</div>
      {statsBits.length ? <div className="detail-event-meta">{statsBits.join(" · ")}</div> : null}
      {payloadText ? <pre className="detail-event-payload">{payloadText}</pre> : null}
    </article>
  );
}

export function EventsModal({ open, eventsPayload, status, onClose }) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const hasItems = items.length > 0;
  return (
    <DetailModal
      modalId="detail-events-modal"
      titleId="detail-events-modal-title"
      title="Luồng sự kiện"
      subtitle="Luồng sự kiện đầy đủ chỉ được yêu cầu khi mở; sau lần tải đầu tiên, dữ liệu được lưu đệm trên trang hiện tại."
      closeButtonId="detail-close-events-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-events-status" className="detail-modal-status">{status}</div>
      <div id="detail-events-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>Chưa có sự kiện</div>
      <div id="detail-events-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {items.map((item, index) => (
          <EventItem key={item?.seq ?? index} item={item} />
        ))}
      </div>
    </DetailModal>
  );
}
