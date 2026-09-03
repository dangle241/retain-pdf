// StatusDetailDialog (blueprint §1 primary component) — Side-by-side
// mirror of components/dialogs/status-detail-dialog-template.js by id/class.
//
// Dialog Rendering layer (Stage C second batch, shadcn refactor): switched from
// native <dialog>+showModal/close to radix-ui Dialog primitives
// (DialogPrimitive.Root/Portal/Overlay/Content), bypassing src/components/ui/dialog.jsx
// default skin (className continues to use existing bespoke CSS — desktop-dialog/
// this desktop-shell bespoke CSS and status-detail-dialog-specific overrides coexist). open
// is controlled by dialogStore (from useStatusDetailOverview's open);
// onOpenChange calls dialogStore.close() uniformly when next===false — unlike
// TranslationWorkflowDialog's two-state semantics (Upload/Status), Close means
// Close, no "open" flow required. All three entry paths — Escape key, backdrop
// click (DismissableLayer outside-click detection), and Close button
// (DialogPrimitive.Close, replacing the old <form method="dialog"> type="submit"
// implicit close) — route through this single callback.
//
// No forceMount on Content (same decision as the 4 Stage C first-batch dialogs;
// see use-dialog-return-focus.js header — forceMount causes Radix modal
// Content's internal hideOthers() side effect to permanently activate at app start).
//
// Dual forceMount interaction (key migration risk): the inner 4 tabs still each
// use TabsPrimitive.Content forceMount + explicit hidden override (Stage B
// decision; semantic rationale in the panel function comments below) — but the
// outer Dialog no longer forceMounts, meaning the entire dialog unmounts when
// closed, along with the 4 inner Tabs, clearing tab-internal useState (e.g.,
// TranslationDebugTab selected item). This is acceptable: forceMount+hidden's
// persistent-mount semantics were designed only for "tab switching within an open
// dialog preserves state", never promising "close and reopen also preserves it" —
// the two are not in conflict (verified with fresh Playwright: switching among
// 4 tabs during dialog open preserves Translation debug selection state across
// switches; see Stage C report).
//
// Tabs implementation (Stage B, shadcn refactor): same approach as
// SettingsHubDialog/CredentialsDialog Select — uses radix-ui Tabs primitives
// directly, bypassing src/components/ui/tabs.jsx default skin to avoid conflicts
// with detail-tabs/detail-tab-panel bespoke CSS. activeTab is driven by
// useStatusDetailOverview's controller.activateDetailTab, with Radix in controlled
// mode. All 4 panels converted to TabsPrimitive.Content (forceMount + explicit
// hidden override); verified that Radix forceMount guarantees "force Rendering
// children" only — visibility is still controlled by the explicitly passed hidden
// prop, which overrides Radix's internal hidden calculation — so
// StageHistoryList/EventsList/TranslationDebugTab internal useState is unaffected
// by tab switching. This is the biggest migration risk point; verified with
// component tests + fresh Playwright (see status-detail-dialog-component.test.mjs
// and Stage B/C reports).

import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { StageHistoryList } from "./StageHistoryList.jsx";
import { EventsList, eventsStatusText } from "./EventsList.jsx";
import { TranslationDebugTab } from "./TranslationDebugTab.jsx";
import { useStatusDetailOverview } from "./useStatusDetailOverview.js";
import { useRerunAction } from "./useRerunAction.js";
import { STATUS_DETAIL_DIALOG_IDS, STATUS_DETAIL_MARKDOWN_BUNDLE_ID } from "./status-detail-dom-ids.js";
import { useHomeServices } from "../../home-services-context.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useArtifactDownloadBusy } from "../../state/use-artifact-download-busy.js";
import { Button } from "../../../../components/Button.jsx";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "failure", label: "Failed" },
  { key: "events", label: "Events" },
  { key: "translation", label: "Advanced Diagnostics", advanced: true },
];

function DetailItem({ id, label, value, optional = false }) {
  // optional rows follow the same semantics as the old world's view.js#toggleOptionalRuntimeRow:
// the element stays permanently in the DOM; only a hidden class is added when the
// value is empty or "-" — not a full row unmount. lastTransition/terminalReason are
// the only two consumers of this semantics.
  const text = `${value ?? "-"}`.trim();
  const rowHidden = optional && (!text || text === "-");
  return (
    <div className={`detail-item${rowHidden ? " hidden" : ""}`}><span className="label">{label}</span><span id={id} className="info-value">{value}</span></div>
  );
}

function OverviewMarkdownBundleLink() {
  // artifact-downloads domain (blueprint §7) — download status originates from
  // statusCardStore (same renderJob callback injection point as ResultActions.jsx;
  // status-detail always shows the current polling job when opened — see
  // composition.js "StatusDetailDialog domain" assembly block comment; the
  // overview's own fetch phase (events/diagnostics/resumePlan) does not include
  // markdownBundleUrl/Ready, so no duplicate derived logic is created here).
  // Click behavior routes through document-level delegated click (controller.js
  // has bindEvents() mounted in composition.js), so the component does not need
  // to attach onClick — it only subscribes to the busy store to drive the
  // "Downloading..." label and disabled state (approach 2).
  const services = useHomeServices();
  const cardSnapshot = useStoreSnapshot(services.statusCard.store);
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, STATUS_DETAIL_MARKDOWN_BUNDLE_ID);
  const ready = Boolean(cardSnapshot.snapshot?.markdownBundleReady);
  const url = cardSnapshot.snapshot?.markdownBundleUrl || "";
  const enabled = ready && Boolean(url) && !busyState.busy;
  const label = busyState.busy ? (busyState.label || "Downloading...") : "Download Markdown ZIP";
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
        <DetailItem id={ids.runtime.currentStage} label="Current Stage" value={runtime.currentStage} />
        <DetailItem id={ids.runtime.stageElapsed} label="Current stage time" value={runtime.stageElapsed} />
        <DetailItem id={ids.runtime.totalElapsed} label="Total Time" value={runtime.totalElapsed} />
        <DetailItem id={ids.runtime.retryCount} label="Retry Count" value={runtime.retryCount} />
        <DetailItem id={ids.runtime.lastTransition} label="Last Transition" value={runtime.lastTransition} optional />
        <DetailItem id={ids.runtime.terminalReason} label="Terminal Reason" value={runtime.terminalReason} optional />
        <DetailItem id={ids.runtime.inputProtocol} label="Input Protocol" value={runtime.inputProtocol} />
        <DetailItem id={ids.runtime.stageSpecVersion} label="Stage Schema" value={runtime.stageSpecVersion} />
        <DetailItem id={ids.runtime.mathMode} label="Formula Mode" value={runtime.mathMode} />
      </div>
      <div className="status-panel detail-stage-panel">
        <div className="status-panel-head"><h3>Stage Timeline</h3></div>
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
          <h3>Failure Diagnostics</h3>
          <span className="status-panel-note">Structured failure summary and troubleshooting suggestions</span>
        </div>
        <div className="failure-action-row">
          <button id={ids.failure.rerunButton} type="button" className="button-link secondary" disabled={rerun.disabled} onClick={rerun.run}>Resume from checkpoint / rerun</button>
          <span id={ids.failure.rerunStatus} className="status-panel-note">{rerun.status || "After a failure, the backend may create a resumed job from existing artifacts."}</span>
        </div>
        <div className="failure-hero-card">
          <span className="label">FailedSummary</span>
          <span id={ids.failure.summary} className="info-value">{failure.summary}</span>
        </div>
        <div className="info-list detail-info-list">
          <div className="info-row"><span className="label">Category</span><span id={ids.failure.category} className="info-value">{failure.category}</span></div>
          <div className="info-row"><span className="label">Stage</span><span id={ids.failure.stage} className="info-value">{failure.stage}</span></div>
          <div className="info-row"><span className="label">Root Cause</span><span id={ids.failure.rootCause} className="info-value">{failure.rootCause}</span></div>
          <div className="info-row"><span className="label">Suggestion</span><span id={ids.failure.suggestion} className="info-value">{failure.suggestion}</span></div>
          <div className="info-row"><span className="label">Latest Log</span><span id={ids.failure.lastLogLine} className="info-value">{failure.lastLogLine}</span></div>
          <div className="info-row"><span className="label">Retryable</span><span id={ids.failure.retryable} className="info-value">{failure.retryable}</span></div>
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
          <h3>Events</h3>
          <span id={ids.events.status} className="status-panel-note">{eventsStatusText(overview.eventsPayload)}</span>
        </div>
        <p className="events-lead">Recent events shown in reverse chronological order. Useful for locating which stage a task is stuck in and what happened before the last failure.</p>
        <EventsList eventsPayload={overview.eventsPayload} />
      </div>
    </TabsPrimitive.Content>
  );
}

function TranslationPanel({ translation, controller, active }) {
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
      <TranslationDebugTab translation={translation} controller={controller} />
    </TabsPrimitive.Content>
  );
}

export function StatusDetailDialog() {
  const { open, activeTab, overview, translation, rerunPending, controller, dialogStore } = useStatusDetailOverview();
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Escape / backdrop click (DismissableLayer outside-click detection) / Close
  // button (DialogPrimitive.Close) all route through this one callback — unlike
  // TranslationWorkflowDialog's two-state semantics, when next===false simply
  // call close().
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
                      <h2>Job Details</h2>
                    </DialogPrimitive.Title>
                    <p className="status-detail-job-meta">Job ID <span id={ids.headline.jobId} className="status-detail-job-id mono">{headline.jobId}</span></p>
                  </div>
                  <p id={ids.headline.note} className="status-panel-note">{headline.note}</p>
                </div>
              </div>
              <DialogPrimitive.Close asChild>
                <Button size={undefined} id={ids.headline.closeButton} className="dialog-close-btn" aria-label="Close">×</Button>
              </DialogPrimitive.Close>
            </div>
            <TabsPrimitive.Root
              className="contents"
              value={activeTab}
              onValueChange={(tab) => controller.activateDetailTab(tab)}
            >
              <div className="desktop-body status-detail-body">
                <TabsPrimitive.List className="detail-tabs" aria-label="Job Details">
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
                  <TranslationPanel translation={translation} controller={controller} active={activeTab === "translation"} />
                </div>
              </div>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}



