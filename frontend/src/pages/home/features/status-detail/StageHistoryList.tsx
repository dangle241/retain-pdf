// Transition state: buildStageHistoryPresentation in src/js/status-detail/history.js
// JSX rewrite of (String template concatenation), copy class names/structure (Blueprint Â§1.1 Verdict table: history.js
// markup Concatenation unused.,Read raw data array;Replace with individual assertions. markup assertions).
//
// Elapsed time/Reuse retained pure logic for timestamp calculation job/stage-history.js + status-detail/utils.js
// (Consistent with precedent in detail page EventsTimeline.jsx, Don't reinvent this formula).

import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  isJobTerminal,
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "../../composition/external.js";

function StageHistoryItem({ entry, index, job, finishedAtFallback }) {
  const duration = resolveStageHistoryDuration(entry, job, { finishedAtFallback });
  const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "In progress");
  const display = stageHistoryDisplay(entry);
  const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
  return (
    <article className="stage-history-item">
      <div className="stage-history-main">
        <span className="stage-history-index">{index + 1}</span>
        <div className="stage-history-copy">
          <div className="stage-history-title">{display.title}</div>
          {display.stage && display.stage !== display.title
            ? <div className="stage-history-stage">{display.stage}</div>
            : null}
          <div className="stage-history-meta">{`${enterAt} → ${exitAt}${terminalText}`}</div>
        </div>
      </div>
      <div className="stage-history-duration">{formatRuntimeDuration(duration)}</div>
    </article>
  );
}

export function StageHistoryList({ job, finishedAtFallback = "" }) {
  const history = resolveStageHistory(job);
  const hasItems = history.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.stageHistory;
  return (
    <>
<div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>No stage records</div>
      <div id={ids.list} className={hasItems ? "stage-history-list" : "stage-history-list hidden"}>
        {history.map((entry, index) => (
          <StageHistoryItem
            key={`${index}-${entry?.stage || entry?.enter_at || ""}`}
            entry={entry}
            index={index}
            job={job}
            finishedAtFallback={finishedAtFallback}
          />
        ))}
      </div>
    </>
  );
}
