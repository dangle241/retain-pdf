// Phase timeline / Event stream: Two trigger cards + Two modals.
// View is src/js/job-detail/events.js String template JSX Rewrite.(Class name/Mirror structure.);
// Retain pure logic for event entry view model reuse. status-view-model.js and job/ layer formatting function.
//
// Dialog rendering layer (Stage C final batch, shadcn refactor): Two modalities from bespoke
// <section className="detail-modal"><div role="dialog" aria-modal="true">
// Replace with Radix Dialog (DialogPrimitive.Root/Portal/Overlay/Content), unify to
// home that set of pages desktop-dialog/desktop-shell/desktop-head/desktop-body Visual
// Skeleton,No longer maintained detail Page-independent. .detail-modal/.detail-modal-panel/
// .detail-modal-head structure (CSS for these three classes removed accordingly
// deleted src/styles/pages/detail/modal.css). detail-modal-title/-subtitle/
// -close/-status these pure layout class names are kept as is(Mount point changed from child of old structure to
// desktop-head/desktop-body child,Visuals unchanged,Content not shared,Not worth unifying into
// cross-subtree dialog-close-btn etc. â Especially detail-modal-close stroke color of
// #d5d7dd and dialog-close-btn #d2d2d7 Literal mismatch. Merge cautiously. Subtle differences. Review changes.
// But pixelmatch Potential differences) New detail-timeline-dialog/
// detail-timeline-overlay Override classes replicate old .detail-modal/.detail-modal-panel
// Pixel-perfect visuals (920px Upper width limit / 82vh High ceiling / 28px Rounded corners / #e5e7eb stroke / Deeper shadow),
// See definition pages/detail/modal.css。
//
// open Status remains DetailApp.jsx stageHistoryOpen/eventsOpen two useStates
// (Iron rule:State management untouched.,Swap render layer only),onOpenChange(false) Unify routing to
// onClose Callback write-back state。
//
// Restore focus:Trigger buttons for both modals(StageHistoryTriggerCard/EventsTriggerCard)
// Although in the same DetailApp Within component tree,Unused.
// DialogPrimitive.Trigger Package Trigger,Radix default triggerRef Always
// nullââthis root cause and "Cross Subtree" unrelated (see use-dialog-return-focus.js head
// Comment), Integrate here too. useDialogReturnFocus, and home page 7 Keep dialog
// consistent, Not because "Appears in same tree." Assume omissible.
//
// body scroll lock: DetailApp.jsx Original handwritten document.body.style.overflow lock
// Deleted (see corresponding comment in file)ââRadix Dialog modal mode has built-in equivalent lock
// (react-remove-scroll, auto-lock/unlock with Content mount/uninstall), Mutually exclusive modals
// (Open only one.,Mask + focus trap Renders other trigger card unreachable.),Won't appear
// Two mechanisms race concurrently. body Style scenarios.

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../shared/react/use-dialog-return-focus.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  stageHistoryDisplay,
  isJobTerminal,
  buildJobDetailEventViewModel,
} from "../external.js";

// —— Copy three private functions verbatim from legacy. events.js,Ensure execution time/payload text byte-for-byte identical ——

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
        <p className="detail-trigger-copy">Collapsed by default, prevents page stretching. Expand to view full stage transition history when needed.</p>
      </div>
    </article>
  );
}

export function EventsTriggerCard({ buttonText, onOpen }) {
  return (
    <article className="detail-card">
      <div className="detail-modal-trigger">
        <div className="detail-trigger-head">
<h2>Event Stream</h2>
          <button id="detail-open-events-btn" type="button" className="detail-trigger-btn" onClick={onOpen}>{buttonText}</button>
        </div>
        <p className="detail-trigger-copy">No event stream request by default. Load only on view click to avoid excess traffic on initial share page open.</p>
      </div>
    </article>
  );
}

function DetailModal({ modalId, titleId, title, subtitle, closeButtonId, open, onClose, children }) {
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

// Esc / Backplane click / Close buttons write back via this single callback. DetailApp.jsx useState.
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
<button id={closeButtonId} type="button" className="detail-modal-close" aria-label="Close">Ã</button>
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
const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "In Progress");
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
      title="stage timeline"
      subtitle="Show entry, exit, duration by phase."
      closeButtonId="detail-close-stage-history-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-stage-history-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>No stage records</div>
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
      title="Event Stream"
      subtitle="Full event stream requested only on open. Cached after first load."
      closeButtonId="detail-close-events-btn"
      open={open}
      onClose={onClose}
    >
      <div id="detail-events-status" className="detail-modal-status">{status}</div>
      <div id="detail-events-empty" className={hasItems ? "detail-empty hidden" : "detail-empty"}>No events</div>
      <div id="detail-events-list" className={hasItems ? "detail-list" : "detail-list hidden"}>
        {items.map((item, index) => (
          <EventItem key={item?.seq ?? index} item={item} />
        ))}
      </div>
    </DetailModal>
  );
}
