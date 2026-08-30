// Vùng tiến độ tab Dịch: attachJobProgress (miền library) + StatusCardEmbedded.
//
// Gắn #book-detail-job-status-card khi có job_id thật;
// sách hoàn tất dùng fallbackItem bổ sung trạng thái cuối (xem status/merge-snapshot-with-fallback).

import { useEffect } from "react";
import { useHomeServices } from "../../../../home-services-context.js";
import { useStoreSnapshot } from "../../../../../../shared/react/use-store.js";
import { StatusCard } from "../../../status/StatusCard.jsx";
import { StageFlow } from "../../../status/StageFlow.jsx";
import type { LibraryCardItem } from "../../types.js";
import { isLibraryOnlyItem } from "../../../../composition/external.js";

function resolveJobId(item: LibraryCardItem = {}) {
  const raw = `${item.job_id || item.active_job_id || ""}`.trim();
  if (!raw || raw.startsWith("doc:")) return "";
  return raw;
}

/**
 * Có nên hiển thị thẻ tiến độ tác vụ hay không.
 * Hiển thị khi có job_id thật; không dùng library_only chặn sách đã hoàn tất
 * vì một số projection library_only có thể sai nhưng job_id tồn tại.
 */
function shouldShowJobProgress(item: LibraryCardItem = {}) {
  const jobId = resolveJobId(item);
  if (!jobId) return false;
  // Tài liệu rõ ràng chỉ trong thư viện với job id tổng hợp đã bị resolveJobId lọc.
  // Có job thật thì hiển thị, kể cả succeeded / running / failed / status rỗng.
  return true;
}

export interface BookTranslateProgressPanelProps {
  item?: LibraryCardItem;
  active?: boolean;
  dialogOpen?: boolean;
}

export function BookTranslateProgressPanel({
  item = {},
  active = true,
  dialogOpen = true,
}: BookTranslateProgressPanelProps) {
  const services = useHomeServices();
  const actions = services.library?.actions;
  const statusCardState = useStoreSnapshot(services.statusCard.store);
  const cardJobId = `${statusCardState?.snapshot?.jobId || ""}`.trim();

  const jobId = resolveJobId(item);
  const showProgress = shouldShowJobProgress(item);
  const libraryOnly = isLibraryOnlyItem(item);
  const itemStatus = `${item.status || ""}`.trim().toLowerCase();

  const cardStatus = `${statusCardState?.snapshot?.status || ""}`.trim().toLowerCase();
  const cardPollingActive = cardStatus === "running"
    || cardStatus === "queued"
    || cardStatus === "pending";

  // Lấy job im lặng: chỉ cấp statusCardStore.
  // Lưu ý: bấm "xxx lại" chuyển sang job_id mới; nếu statusCard đang chạy job mới thì không ghi đè bằng id cũ.
  useEffect(() => {
    if (!dialogOpen || !showProgress || !jobId) return undefined;
    if (cardJobId === jobId) return undefined;
    if (cardJobId && cardPollingActive && cardJobId !== jobId) {
      return undefined;
    }
    actions?.attachJobProgress?.(jobId);
    return undefined;
    // Cố ý không đưa actions vào deps vì tham chiếu services ổn định, tránh chạy lại vô nghĩa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress, jobId, cardJobId, cardPollingActive]);

  // Tiến độ chính ở chi tiết: chỉ tắt vùng trạng thái chính khi đang thấy, tránh setVisible thông báo mỗi khung thành vòng lặp.
  useEffect(() => {
    if (!dialogOpen || !showProgress) return undefined;
    if (services.statusArea?.isVisible?.()) {
      services.statusArea.setVisible(false);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, showProgress]);

  // Tài liệu thư viện chưa dịch: trạng thái trống.
  if (!showProgress) {
    return (
      <div
        id="book-detail-translate-progress"
        className="book-translate-progress space-y-3 rounded-xl border border-border/60 px-4 py-3.5"
        data-state="idle"
        data-library-only={libraryOnly ? "true" : "false"}
        data-item-status={itemStatus || ""}
        data-job-id=""
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quy trình dịch
        </p>
        {/* Trạng thái trống chỉ giữ "xem trước lộ trình" theo hợp đồng test; không kết xuất thanh tiến độ giả/0% nữa;
            các máy trạng thái tắt xếp chồng là nguyên nhân chính của giao diện xám trên xám. */}
        <div className="pointer-events-none">
          <StageFlow
            id="book-detail-stage-flow"
            currentStageKey=""
            selectedStageKey=""
            onSelectStage={() => {}}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Chưa bắt đầu dịch. Chọn toàn bộ hoặc phạm vi trang bên dưới để bắt đầu; tiến độ sẽ xuất hiện tại đây theo thời gian thực.
        </p>
      </div>
    );
  }

  // fallback: ưu tiên job statusCard đang phát, gồm id thử lại mới, tránh mục cũ ghi đè về trạng thái hoàn tất.
  const liveFallback = cardJobId && cardJobId !== jobId
    ? {
        ...item,
        job_id: cardJobId,
        active_job_id: cardJobId,
        library_only: false,
        status: cardStatus || item.status,
      }
    : item;

  // Có job: luôn gắn StatusCard đầy đủ.
  // Tabs.Content cha dùng data-[state=inactive]:hidden để ẩn bảng; nút vẫn trong DOM
  // (có thể tìm #book-detail-job-status-card trong công cụ phát triển).
  return (
    <div
      id="book-detail-translate-progress"
      className="book-translate-progress"
      data-job-id={cardJobId || jobId}
      data-state={itemStatus === "succeeded" && !cardPollingActive ? "succeeded" : "ready"}
      data-item-status={itemStatus || ""}
      data-library-only={libraryOnly ? "true" : "false"}
      data-tab-active={active ? "true" : "false"}
    >
      <div className="book-detail-status-card-host">
        <StatusCard
          visible
          embedded
          idPrefix="book-detail-"
          rootId="book-detail-job-status-card"
          fallbackItem={liveFallback}
          showHiddenContract={false}
          showResultActions={false}
        />
      </div>
    </div>
  );
}
