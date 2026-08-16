// Danh sách luồng sự kiện: bản viết lại JSX của buildEventsPresentation trong src/js/status-detail/events.js
// (nối template chuỗi), giữ nguyên tên lớp/cấu trúc (bảng quyết định thiết kế §1.1: events.js
// không dùng phần nối markup, chuyển sang đọc mảng dữ liệu gốc; assert từng mục thay cho assert markup).
//
// Sao chép nguyên quy tắc xác định tone + sắp xếp từ events.js (cùng tiền lệ với EventsTimeline.jsx ở trang chi tiết
// và formatEventPayload; sao chép trực tiếp hàm nhỏ vào file component, không thêm tầng
// model.js; bản thân file cũ không thể import và phạm vi sao chép rất nhỏ).

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
          <summary className="event-payload-toggle">Xem payload</summary>
          <pre className="event-payload">{payloadText}</pre>
        </details>
      ) : null}
    </article>
  );
}

export function EventsList({ eventsPayload }) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  // Nội dung hứa "theo thời gian giảm dần", nên sắp xếp tường minh tại đây, không phụ thuộc thứ tự backend trả về (theo events.js).
  const entries = items
    .map((item) => ({ item, record: normalizedStageEventRecord(item) }))
    .sort((a, b) => (Date.parse(b.record.timestamp) || 0) - (Date.parse(a.record.timestamp) || 0));
  const hasItems = items.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.events;
  return (
    <>
      <div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>Chưa có sự kiện</div>
      <div id={ids.list} className={hasItems ? "events-list" : "events-list hidden"}>
        {entries.map(({ item }, index) => (
          // Tiền tố vị trí sau sắp xếp bảo đảm tính duy nhất; không thể chỉ dùng item.seq/event_id (cả mock lẫn dữ liệu thật đều
          // có sự kiện thiếu hai trường này; fallback về index có thể trùng key với mục thực sự có seq).
          <EventItem key={`${index}-${item?.seq ?? item?.event_id ?? ""}`} item={item} />
        ))}
      </div>
    </>
  );
}

export function eventsStatusText(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  return items.length > 0 ? `${items.length} mục gần nhất` : "Chưa có sự kiện";
}
