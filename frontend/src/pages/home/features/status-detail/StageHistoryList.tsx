// Danh sách dòng thời gian quy trình: bản viết lại JSX của buildStageHistoryPresentation trong src/js/status-detail/history.js
// (nối template chuỗi), giữ nguyên tên lớp/cấu trúc (bảng quyết định thiết kế §1.1: history.js
// không dùng phần nối markup, chuyển sang đọc mảng dữ liệu gốc; assert từng mục thay cho assert markup).
//
// phần tính thời lượng/dấu thời gian tái sử dụng logic thuần được giữ lại trong job/stage-history.js + status-detail/utils.js
// (cùng tiền lệ với EventsTimeline.jsx ở trang chi tiết, không tự viết lại các công thức này).

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
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "Đang thực hiện");
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
      <div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>Chưa có bản ghi giai đoạn</div>
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
