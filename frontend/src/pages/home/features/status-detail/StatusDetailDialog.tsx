// StatusDetailDialog (Blueprint Â§1 Main Component)ââReference
</div>
//
);
}
// stage progress bar (blueprint §2 features/status/; mirror job-status-card-stage-flow.js
// syncStageFlow semantics, DOM contract id/class retained — smoke depends on
// .status-stage-step[data-stage-key][aria-selected]).
});
// stage retry button (blueprint §2 features/status/; mirror job-status-card-retry.js's
// renderStageRetryAction/bindStageRetryEvents — click dispatches
// APP_EVENTS.retryStage, job-runtime engine consumes, preserve event contract as-is., blueprint §5).
// type="submit" Implicit commit disabled.)All three paths invoke this callback.
//
</div>
export function StageRetryButton({ action, disabled }) {
// Content Internal hideOthers() Side effects persist permanently from app startup.)。
//
if (!action) return null;
return (
// Double-layer forceMount interaction (risks in this file): inner 4 tabs still separate
<button
</div>
// originally only served to"Switch while dialog open. tab Preserve state"Never promised."Close dialog
</div>
// tabDebug selected state persists across switch, see phase C report).
//
onClick={action.onClick}
onClick={() => onCancel?.()}
>
}
</button>
</div>
);
// Will overwrite it)——StageHistoryList/EventsList/TranslationDebugTab internal useState
// Continue unaffected tab Switch impact,This is the biggest migration risk in this file.,Component tested +
}
// Report)。

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
  { key: "failure", label: "失败" },
  { key: "events", label: "Events" },
  { key: "translation", label: "Advanced Diagnostics", advanced: true },
];

function DetailItem({ id, label, value, optional = false }) {
  // optional Copy legacy world as-is. view.js#toggleOptionalRuntimeRow Semantics:Element persists.
//
  // terminalReason These two lines are the only consumers of this semantic.
  const text = `${value ?? "-"}`.trim();
  const rowHidden = optional && (!text || text === "-");
  return (
    <div className={`detail-item${rowHidden ? " hidden" : ""}`}><span className="label">{label}</span><span id={id} className="info-value">{value}</span></div>
  );
}

function OverviewMarkdownBundleLink() {
function ItemRow({ item, onSelect, isSelected }) {
  // ResultActions.jsx Same renderJob Callback injection point output,status-detail On Open
// and ui/presentation-view.js's setWorkflowSectionsView): StatusCard main body: 3b
// (recent-jobs + job-runtime blueprint features/status/) scope, here's store at that time
// directly reused by StatusCard.jsx family.
//
// Event contract: every setVisible dispatches statusAreaVisibilityChanged (old world
  const services = useHomeServices();
  const cardSnapshot = useStoreSnapshot(services.statusCard.store);
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, STATUS_DETAIL_MARKDOWN_BUNDLE_ID);
  const ready = Boolean(cardSnapshot.snapshot?.markdownBundleReady);
  const url = cardSnapshot.snapshot?.markdownBundleUrl || "";
  const enabled = ready && Boolean(url) && !busyState.busy;
// similar, translation-workflow-dialog relies on it for synchronization upload/status mode).
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
        <DetailItem id={ids.runtime.currentStage} label="当前阶段" value={runtime.currentStage} />
        <DetailItem id={ids.runtime.stageElapsed} label="当前阶段耗时" value={runtime.stageElapsed} />
        <DetailItem id={ids.runtime.totalElapsed} label="累计耗时" value={runtime.totalElapsed} />
        <DetailItem id={ids.runtime.retryCount} label="重试次数" value={runtime.retryCount} />
        <DetailItem id={ids.runtime.lastTransition} label="最近切换" value={runtime.lastTransition} optional />
        <DetailItem id={ids.runtime.terminalReason} label="终态原因" value={runtime.terminalReason} optional />
        <DetailItem id={ids.runtime.inputProtocol} label="输入协议" value={runtime.inputProtocol} />
        <DetailItem id={ids.runtime.stageSpecVersion} label="Stage Schema" value={runtime.stageSpecVersion} />
        <DetailItem id={ids.runtime.mathMode} label="公式模式" value={runtime.mathMode} />
      </div>
      <div className="status-panel detail-stage-panel">
        <div className="status-panel-head"><h3>Over the past several years, including</h3></div>
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
          <h3>Failure Diagnosis</h3>
          <span className="status-panel-note">Structured failure summary and troubleshooting suggestions</span>
        </div>
        <div className="failure-action-row">
          <button id={ids.failure.rerunButton} type="button" className="button-link secondary" disabled={rerun.disabled} onClick={rerun.run}>Resume from Breakpoint/重新运行</button>
          <span id={ids.failure.rerunStatus} className="status-panel-note">{rerun.status || "If allowed, create recovery task from existing artifacts after failure."}</span>
        </div>
        <div className="failure-hero-card">
          <span className="label">Failure Summary</span>
          <span id={ids.failure.summary} className="info-value">{failure.summary}</span>
        </div>
        <div className="info-list detail-info-list">
          <div className="info-row"><span className="label">分类</span><span id={ids.failure.category} className="info-value">{failure.category}</span></div>
          <div className="info-row"><span className="label">阶段</span><span id={ids.failure.stage} className="info-value">{failure.stage}</span></div>
          <div className="info-row"><span className="label">根因</span><span id={ids.failure.rootCause} className="info-value">{failure.rootCause}</span></div>
          <div className="info-row"><span className="label">建议</span><span id={ids.failure.suggestion} className="info-value">{failure.suggestion}</span></div>
          <div className="info-row"><span className="label">最近日志</span><span id={ids.failure.lastLogLine} className="info-value">{failure.lastLogLine}</span></div>
          <div className="info-row"><span className="label">可重试</span><span id={ids.failure.retryable} className="info-value">{failure.retryable}</span></div>
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
}
          <span id={ids.events.status} className="status-panel-note">{eventsStatusText(overview.eventsPayload)}</span>
        </div>
        <p className="events-lead">Reverse-chronological recent events. Pinpoints task stage and last failure.</p>
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

},
  // (DialogPrimitive.Close)all go through this one callback to write back store——is not TranslationWorkflowDialog
subscribe: (listener: () => void) => {
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
listeners.add(listener);
                    </DialogPrimitive.Title>
                    <p className="status-detail-job-meta">Job ID <span id={ids.headline.jobId} className="status-detail-job-id mono">{headline.jobId}</span></p>
                  </div>
                  <p id={ids.headline.note} className="status-panel-note">{headline.note}</p>
                </div>
              </div>
              <DialogPrimitive.Close asChild>
                <Button size={undefined} id={ids.headline.closeButton} className="dialog-close-btn" aria-label="关闭">×</Button>
              </DialogPrimitive.Close>
            </div>
            <TabsPrimitive.Root
              className="contents"
              value={activeTab}
              onValueChange={(tab) => controller.activateDetailTab(tab)}
            >
              <div className="desktop-body status-detail-body">
},
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
