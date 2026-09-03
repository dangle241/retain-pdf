// Events stream list: JSX rewrite of src/js/status-detail/events.js's buildEventsPresentation
// (string template assembly), class names/structure copied (blueprint §1.1 verdict table:
// events.js markup assembly part not used, reads raw data array instead; per-entry
// assertions replace markup assertions).
//
// Tone determination + sort rules copied verbatim from events.js (consistent with
// detail pages EventsTimeline.jsx's formatEventPayload precedent; small functions
// copied directly into component files, no new model.js layer — old files themselves
// cannot be imported, the copied surface is tiny).

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
  // Sort explicitly by time descending; do not rely on backend order (same as events.js)
  const entries = items
    .map((item) => ({ item, record: normalizedStageEventRecord(item) }))
    .sort((a, b) => (Date.parse(b.record.timestamp) || 0) - (Date.parse(a.record.timestamp) || 0));
  const hasItems = items.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.events;
  return (
    <>
      <div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>No Events</div>
      <div id={ids.list} className={hasItems ? "events-list" : "events-list hidden"}>
        {entries.map(({ item }, index) => (
          // Sort position prefix guarantees uniqueness — cannot use item.seq/event_id alone (both mock and real data
          // have been observed to lack these two fields in some events; falling back to index would collide with entries that do have seq).
          <EventItem key={`${index}-${item?.seq ?? item?.event_id ?? ""}`} item={item} />
        ))}
      </div>
    </>
  );
}

export function eventsStatusText(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  return items.length > 0 ? `Last ${items.length} entries` : "No Events";
}




