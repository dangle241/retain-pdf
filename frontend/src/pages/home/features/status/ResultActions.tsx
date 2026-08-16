// Hàng thao tác kết quả (thiết kế §2 features/status/); phản chiếu
// syncPrimaryActions/setActionLinkState trong job-status-card-rendering.js; giữ từng ID/class của hợp đồng DOM).
//
// Liên kết "Đọc đối chiếu" (mục 6① phạm vi thi công Dialog trong thiết kế §4): xác minh runtime cho thấy
// 3b chỉ render <a href="reader.html?..."> thuần, không chặn click; chuyển toàn trang sẽ
// làm gián đoạn trải nghiệm hộp thoại SPA, vì vậy thêm onClick (preventDefault + onReaderClick)
// đi qua điểm vào openReaderRequested thống nhất của ReaderDialog; giữ href làm
// phương án dự phòng khi JS không hoạt động.
//
// Ba liên kết tải markdownBundle/sourcePdf/pdf (thiết kế Dialog §7): các ID này
// khớp trình xử lý click ủy quyền cấp document của miền artifact-downloads (
// handleProtectedArtifactClick trong controller.js; composition.js đã gắn bindEvents()); khi click,
// trình xử lý sẽ chạy event.preventDefault() trước điều hướng mặc định của <a>; bản thân nút
// không cần thêm onClick (click ủy quyền không phụ thuộc ai render nút). Tại đây chỉ đăng ký
// lát cắt actionId tương ứng trong artifact-download-busy-store.js để điều khiển nội dung "Đang tải xuống...".
// và trạng thái vô hiệu hóa (phương án hai: tránh việc component cha render lại do polling và ghi đè nội dung tiến độ tải xuống được ghi theo kiểu mệnh lệnh
// trở về nhãn ban đầu).

import { useHomeServices } from "../../home-services-context.js";
import { useArtifactDownloadBusy } from "../../state/use-artifact-download-busy.js";
import { STATUS_CARD_ACTION_IDS } from "./status-card-dom-ids.js";

type ActionLinkProps = {
  id: string;
  label: string;
  ready: boolean;
  url: string;
  onClick?: () => void;
};

function ActionLink({ id, label, ready, url, onClick }: ActionLinkProps) {
  const services = useHomeServices();
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, id);
  const enabled = Boolean(ready && url) && !busyState.busy;
  const isReaderLink = id === STATUS_CARD_ACTION_IDS.reader;
  const displayLabel = busyState.busy ? (busyState.label || "Đang tải xuống...") : label;
  return (
    <a
      id={id}
      className={`status-action-btn task-toolbar-btn-result${ready ? "" : " hidden"}${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target={isReaderLink ? undefined : "_blank"}
      rel={isReaderLink ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
      onClick={isReaderLink && onClick
        ? (event) => {
          if (!enabled) {
            return;
          }
          event.preventDefault();
          onClick();
        }
        : undefined}
    >
      <span>{displayLabel}</span>
    </a>
  );
}

type ResultActionsProps = {
  markdownBundleReady?: boolean;
  markdownBundleUrl?: string;
  sourcePdfReady?: boolean;
  sourcePdfUrl?: string;
  readerReady?: boolean;
  readerUrl?: string;
  pdfReady?: boolean;
  pdfUrl?: string;
  onReaderClick?: () => void;
};

export function ResultActions({
  markdownBundleReady = false,
  markdownBundleUrl = "",
  sourcePdfReady = false,
  sourcePdfUrl = "",
  readerReady = false,
  readerUrl = "",
  pdfReady = false,
  pdfUrl = "",
  onReaderClick,
}: ResultActionsProps) {
  const hasActions = markdownBundleReady || pdfReady || readerReady || sourcePdfReady;

  return (
    <div className={`status-result-actions${hasActions ? "" : " hidden"}`}>
      <ActionLink id={STATUS_CARD_ACTION_IDS.markdownBundle} label="Tải Markdown" ready={markdownBundleReady} url={markdownBundleUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.sourcePdf} label="Tải PDF gốc" ready={sourcePdfReady} url={sourcePdfUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.reader} label="Đọc đối chiếu" ready={readerReady} url={readerUrl} onClick={onReaderClick} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.pdf} label="Tải PDF" ready={pdfReady} url={pdfUrl} />
    </div>
  );
}
