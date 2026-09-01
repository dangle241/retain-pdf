// Event Stream List: buildEventsPresentation in src/js/status-detail/events.js
// JSX rewrite of (String template concatenation), copy class names/structure (Blueprint Â§1.1 Verdict table: events.js
// markup Concatenation unused.,Read raw data array;Replace with individual assertions. markup assertions).
//
// tone Determine + Sort order from events.js Copy as-is (consistent with detail page EventsTimeline.jsx
// formatEventPayload precedent, Inline small functions into component file, No new layer
// model.js——Old file unusable. import,Copy area small)。

import { useState } from "react";
import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import {
  normalizedStageEventRecord,
  formatEventTimestamp,
} from "../../composition/external.js";

function eventBadgeTone(item) {
  if (item.level === "error" || item.event === "failure_classified" || item.event === "job_terminal") {
    return "error";
  }
  if (item.level === "warn" || item.event === "retry_scheduled") {
    return "warn";
  }
  return "";
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

function EventItem({ item }) {
  const [payloadOpen, setPayloadOpen] = useState(false);
  const record = normalizedStageEventRecord(item);
  const tone = eventBadgeTone(item);
  const payloadText = formatEventPayload(item.payload);
  const title = record.stageText || item.message || "-";
  const showProgress = record.progressText && record.progressText !== title;
  return (
    <article className="event-item">
      <div className="event-meta">
        <span className={`event-badge${tone ? ` ${tone}` : ""}`}>{item.event || "-"}</span>
        <span>{formatEventTimestamp(record.timestamp)}</span>
        <span>{record.displayStage || record.rawStage || "-"}</span>
        {record.substage ? <span>{record.substage}</span> : null}
        {record.lane && record.lane !== "main" ? <span>{`lane:${record.lane}`}</span> : null}
        <span>{item.level || "-"}</span>
      </div>
      <div className="event-title">{title}</div>
      {showProgress ? <div className="event-progress">{record.progressText}</div> : null}
      {payloadText ? (
        <details className="event-payload-wrap" open={payloadOpen} onToggle={(event) => setPayloadOpen(event.currentTarget.open)}>
<summary className="event-payload-toggle">View payload</summary>
          <pre className="event-payload">{payloadText}</pre>
        </details>
      ) : null}
    </article>
  );
}

export function EventsList({ eventsPayload }) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
// Copy commitment "reverse chronological order", explicit sort here, do not rely on backend order (copy events.js)
  const entries = items
    .map((item) => ({ item, record: normalizedStageEventRecord(item) }))
    .sort((a, b) => (Date.parse(b.record.timestamp) || 0) - (Date.parse(a.record.timestamp) || 0));
  const hasItems = items.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.events;
  return (
    <>
<div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>No events</div>
      <div id={ids.list} className={hasItems ? "events-list" : "events-list hidden"}>
        {entries.map(({ item }, index) => (
          // Ensure unique rank prefix after sorting.——Cannot use only item.seq/event_id(mock/Real data
          // Observed some events missing these two fields,Go back index Will"Confirmed seq"Entry key collision)。
          <EventItem key={`${index}-${item?.seq ?? item?.event_id ?? ""}`} item={item} />
        ))}
      </div>
    </>
  );
}

export function eventsStatusText(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
return items.length > 0 ? `Last ${items.length} items` : "No events";
}
