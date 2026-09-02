// Stage timeline / events stream: two trigger cards + two modals.
// View is a JSX rewrite of the src/js/job-detail/events.js string templates (class names/structure copied);
// event-entry view model reuses retained pure-logic status-view-model.js and job/ formatters.
//
// Dialog rendering layer (Stage C wrap-up, shadcn migration): both modals moved from bespoke
// <section className="detail-modal"><div role="dialog" aria-modal="true">
// to Radix Dialog (DialogPrimitive.Root/Portal/Overlay/Content), unified onto the
// home page desktop-dialog/desktop-shell/desktop-head/desktop-body visual
// skeleton, no longer keeping the detail-page-only .detail-modal/.detail-modal-panel/
// .detail-modal-head structure (CSS for those three classes was then
// deleted from src/styles/pages/detail/modal.css). The purely typographic
// detail-modal-title/-subtitle/-close/-status class names are kept as-is
// (mount point moved from children of the old structure to children of
// desktop-head/desktop-body; look is unchanged and content is not shared, so it is
// not worth unifying into cross-dialog helpers like dialog-close-btn——especially
// since detail-modal-close's border color #d5d7dd and dialog-close-btn's #d2d2d7
// are different literals, and a hasty merge would introduce differences that are
// hard to see by eye but pixelmatch might catch). The new detail-timeline-dialog/
// detail-timeline-overlay overlay classes clone the pixel-level look of the old
// .detail-modal/.detail-modal-panel (920px max width / 82vh max height / 28px radius /
// #e5e7eb border / deeper shadow); defined in pages/detail/modal.css.
//
// open state is still DetailApp.jsx's stageHistoryOpen/eventsOpen useState pair
// (iron rule: do not change state management itself, only the rendering layer);
// onOpenChange(false) is routed uniformly to the onClose callback that writes state back.
//
// Focus restore: the two modals' trigger buttons (StageHistoryTriggerCard/EventsTriggerCard)
// live in the same DetailApp tree as the modals themselves, but the triggers are not
// wrapped in DialogPrimitive.Trigger, so Radix's default triggerRef is always
// null——this root cause is unrelated to "whether it crosses subtrees" (see the
// use-dialog-return-focus.js header comment). So this file also wires
// useDialogReturnFocus, matching the home page's 7 dialogs; do not assume it can
// be omitted just because "it looks like one tree".
//
// Body scroll lock: DetailApp.jsx's handwritten document.body.style.overflow lock
// was deleted (see that file's matching comment)——Radix Dialog modal mode already
// ships an equivalent lock (react-remove-scroll, auto lock/unlock with Content
// mount/unmount). The two modals are mutually exclusive (once one is open, overlay +
// focus trap make the other trigger card unreachable), so two mechanisms will not
// race body styles.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../shared/react/use-dialog-return-focus.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  stageHistoryDisplay,
  isJobTerminal,
  buildJobDetailEventViewModel,
} from "../external.js";

// —— The next three private functions copy old events.js so duration/payload copy matches byte-for-byte ——

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
          <h2>Stage Timeline</h2>
          <button id="detail-open-stage-history-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>View</button>
        </div>
        <p className="detail-trigger-copy">Collapsed by default to avoid stretching the page. Open when needed to view full stage transition history.</p>
      </div>
    </article>
  );
}

export function EventsTriggerCard({ buttonText, onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
          <h2>Events Stream</h2>
          <button id="detail-open-events-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>{buttonText}</button>
        </div>
        <p className="detail-trigger-copy">Events stream is not requested by default. Only loaded when View is clicked to avoid excessive bandwidth usage on first page load.</p>
      </div>
    </article>
  );
}

function DetailModal({ modalId, titleId, title, subtitle, closeButtonId, open, onClose, children }) {
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Esc / backdrop click / Close button all write back DetailApp.jsx useState via this one callback.
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
                <button id={closeButtonId} type="button" className="detail-modal-close" aria-label="Close">×</button>
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
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "In progress");
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
      title="Stage Timeline"
      subtitle="Shows entry, exit, and duration per stage."
      closeButtonId="detail-close-stage-history-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-stage-history-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>No Stage Records</div>
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
      title="Events Stream"
      subtitle="Full events stream is requested only when opened. Cached on current page after first load."
      closeButtonId="detail-close-events-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-events-status" className="detail-modal-status">{status}</div>
      <div id="detail-events-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>No Events</div>
      <div id="detail-events-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {items.map((item, index) => (
          <EventItem key={item?.seq ?? index} item={item} />
        ))}
      </div>
    </DetailModal>
  );
}





