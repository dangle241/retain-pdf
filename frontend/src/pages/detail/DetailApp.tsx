// Gốc điều phối React của trang chi tiết tác vụ (bản viết lại của src/js/job-detail/index.js + view.js +
// modal-bindings.js + downloads.js + bộ khởi động events.js cũ).
//
// Chiến lược trạng thái (theo ngữ nghĩa hiện tại, không thêm store):
// - Logic thuần cũ (overview-renderer / markdown-flow / summary / action-links /
//   resume, v.v.) ghi nội dung qua callback setText/setActionLink/setEventsStatus; tại đây
//   callback được triển khai bằng React state (hai map texts/links), JSX lấy giá trị theo id để kết xuất;
// - Danh sách đầu ra, ngữ cảnh gỡ lỗi và lưới ảnh Markdown vẫn do mô-đun cũ được giữ lại
//   (artifacts.js / failure.js, qua overview-renderer / markdown-flow) ghi sau khi gắn
//   bằng innerHTML mệnh lệnh vào container lá do React kết xuất (xem chú thích từng thành phần);
// - Đóng/mở modal, tải luồng sự kiện và tải xuống được bảo vệ chuyển sang React quản lý (trách nhiệm cũ của view.js /
//   modal-bindings.js / bộ khởi động events.js / downloads.js).

import { useCallback, useEffect, useRef, useState } from "react";
import { DetailHeader } from "./components/DetailHeader.jsx";
import { ErrorNoticeCard, JobSummaryCard, MetaRow } from "./components/JobSummaryCard.jsx";
import { ErrorDiagnostics } from "./components/ErrorDiagnostics.jsx";
import { ArtifactsSection, MarkdownCard } from "./components/ArtifactsSection.jsx";
import {
  EventsModal,
  EventsTriggerCard,
  StageHistoryModal,
  StageHistoryTriggerCard,
} from "./components/EventsTimeline.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import {
  normalizeJobPayload,
  getJobIdFromQuery,
  defaultJobDetailConfigPort,
  defaultJobDetailDataPort,
  defaultJobDetailResumePort,
  bindRerunButton,
  renderJobDetailOverview,
  loadAndRenderMarkdownFlow,
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "./external.js";

const JOB_EVENTS_PAGE_SIZE = 200;

function eventsStatusText(payload) {
  const count = Array.isArray(payload?.items) ? payload.items.length : 0;
  return count > 0 ? `Tất cả sự kiện · ${count} mục` : "Tất cả sự kiện";
}

export function DetailApp({
  configPort = defaultJobDetailConfigPort,
  dataPort = defaultJobDetailDataPort,
  getJobId = getJobIdFromQuery,
  resumePort = defaultJobDetailResumePort,
} = {}) {
  const pageStateRef = useRef(null);
  if (!pageStateRef.current) {
    pageStateRef.current = createJobDetailPageState();
  }
  const [texts, setTexts] = useState({});
  const [links, setLinks] = useState({});
  const [job, setJob] = useState(null);
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [eventsPayload, setEventsPayload] = useState(null);
  const [eventsStatus, setEventsStatus] = useState("Chưa tải");
  const [openEventsText, setOpenEventsText] = useState("Tải khi cần");

  // Ngữ nghĩa setDetailText của view.js cũ: value ?? "-".
  const setText = useCallback((id, value) => {
    setTexts((prev) => ({ ...prev, [id]: value ?? "-" }));
  }, []);

  // Ngữ nghĩa setDetailActionLink của view.js cũ: bộ ba href/disabled/aria-disabled.
  const setActionLink = useCallback((id, url, enabled) => {
    setLinks((prev) => ({ ...prev, [id]: { url, enabled: Boolean(enabled) } }));
  }, []);

  const t = useCallback(
    (id, fallback = "-") => (Object.hasOwn(texts, id) ? texts[id] : fallback),
    [texts],
  );

  // Điều phối tải trang: dựng lại hook initializePage của index.js cũ.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const state = pageStateRef.current;
    window.addEventListener("beforeunload", () => {
      revokeJobDetailMarkdownImageUrls(state);
    }, { once: true });
    bindRerunButton({
      detailPageState: state,
      getJobId,
      resumePort,
      setText,
    });
    (async () => {
      const jobId = getJobId();
      if (!jobId) {
        setText("detail-head-note", "Thiếu job_id; vui lòng mở bằng detail.html?job_id=...");
        return;
      }
      setText("detail-job-id", jobId);
      setText("detail-head-note", configPort.detailShareNote());

      const {
        diagnosticsPayload,
        manifestPayload,
        payloadRaw,
        resumePlan,
      } = await dataPort.loadOverview(jobId);
      const nextJob = normalizeJobPayload(payloadRaw);
      renderJobDetailOverview({
        diagnosticsPayload,
        job: nextJob,
        manifestPayload,
        resumePlan,
        setActionLink,
        setEventsStatus,
        setText,
        state,
      });
      setJob(nextJob);

      await loadAndRenderMarkdownFlow({
        fetchProtected: dataPort.fetchProtected,
        job: nextJob,
        jobId,
        loadMarkdownPayload: dataPort.loadMarkdownPayload,
        markdownImageUrls: state.markdownImageUrls,
        setActionLink,
        setText,
        state,
      });
    })().catch((error) => {
      // Ngữ nghĩa onError của createPageRuntime cũ: ghi lỗi khởi tạo vào thông báo đầu trang.
      setText("detail-head-note", error.message || String(error));
    });
    // Chỉ chạy một lần khi gắn; port không đổi trong vòng đời trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // modal-bindings.js cũ: Escape đóng tất cả modal.
  //
  // Quyết định đợt kết thúc giai đoạn C (chuyển đổi shadcn): sau khi hai modal đổi sang Radix Dialog, giữ listener
  // viết tay "đóng cả hai vô điều kiện", không đổi thành "chỉ đóng modal đang mở". Lý do: mỗi modal
  // là Radix Root/Content độc lập fixed inset-0; khi mở dùng DismissableLayer
  // chiếm focus (focus trap); khi StageHistoryModal mở, thẻ kích hoạt
  // EventsTriggerCard bị overlay che hoàn toàn và không thể focus/bấm, ngược lại cũng vậy, nên hai
  // modal luôn loại trừ nhau trong cấu trúc trang này (tối đa một open=true cùng lúc). Điều đó nghĩa là
  // "đóng cả hai" và "chỉ đóng cái hiện tại" cho cùng kết quả ở mọi trạng thái có thể đạt; setStageHistoryOpen/
  // setEventsOpen gọi bên đã false là no-op lũy đẳng, không có nguy cơ double-fire
  // làm hỏng ngữ nghĩa (khác với đóng hai bước của TranslationWorkflowDialog, nơi thực sự có thể
  // bị phá bởi "gọi thêm một lần"). Giữ nguyên là lựa chọn rủi ro thấp nhất trong đợt chuyển đổi này, không
  // thêm nhánh mới để siết hành vi không thể quan sát trong UI hiện tại.
  //
  // Listener này và xử lý Escape của Radix (DismissableLayer, pha capture) sẽ
  // cùng chạy trong một lần nhấn: Radix gọi onOpenChange(false) cho "modal đang mở" trước
  // (setXxxOpen(false) tương ứng có hiệu lực), sau đó listener pha bubble tại đây gọi cả hai
  // một lần setXxxOpen(false); bên đã false là no-op, không tạo kết xuất hoặc
  // tác dụng phụ thêm nên hai cơ chế không xung đột.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      setStageHistoryOpen(false);
      setEventsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Cách khóa cuộn body viết tay trong setDetailModalOpen của view.js cũ đã xóa: Radix Dialog
  // chế độ modal mặc định có khóa cuộn body tương đương (react-remove-scroll gắn trên
  // DialogPrimitive.Content, tự động theo vòng đời mount/unmount thật của Content để
  // khóa/mở; xem DetailModal trong EventsTimeline.jsx). Giữ đoạn viết tay
  // gán document.body.style.overflow sẽ tạo hai writer độc lập cùng cơ chế khóa của Radix
  // tranh chấp cùng thuộc tính CSS; react-remove-scroll ghi nhớ nội bộ "giá trị overflow gốc
  // trước khi khóa" và khôi phục chính xác khi mở; nếu lại gán/xóa trực tiếp tại đây, trong
  // trường hợp biên thời điểm mở khóa không nhất quán, thuộc tính có thể bị đặt thành giá trị khác Radix đã nhớ (biểu hiện
  // là đóng modal nhưng body vẫn không cuộn được, hoặc ngược lại). Hai modal loại trừ nhau như trên,
  // độ chi tiết khóa theo nhu cầu của Radix, tương ứng Content có gắn hay không, đã bao phủ hoàn toàn
  // ngữ nghĩa của cách cũ nên không cần viết tay nữa.

  // events.js cũ: fetchAllJobEvents + ensureEventsLoaded (lấy đầy đủ qua phân trang + cache trong trang).
  const ensureEventsLoaded = useCallback(async () => {
    const state = pageStateRef.current;
    if (state.eventsPayload) {
      return state.eventsPayload;
    }
    if (!state.job?.job_id) {
      throw new Error("Thiếu job_id nên không thể tải luồng sự kiện.");
    }
    if (!state.eventsLoadingPromise) {
      setEventsStatus("Đang tải tất cả sự kiện...");
      state.eventsLoadingPromise = (async () => {
        const items = [];
        let offset = 0;
        while (true) {
          const payload = await dataPort.fetchJobEvents(
            state.job.job_id,
            dataPort.apiPrefix,
            JOB_EVENTS_PAGE_SIZE,
            offset,
          );
          const page = (payload || {}) as { items?: unknown[] };
          const batch = Array.isArray(page.items) ? page.items : [];
          items.push(...batch);
          if (batch.length < JOB_EVENTS_PAGE_SIZE) {
            return {
              ...(typeof payload === "object" && payload ? payload : {}),
              items,
              offset: 0,
              limit: items.length,
            };
          }
          offset += batch.length;
        }
      })()
        .then((payload) => {
          state.eventsPayload = payload;
          return payload;
        })
        .catch((error) => {
          setEventsStatus(error.message || "Không thể tải luồng sự kiện.");
          throw error;
        })
        .finally(() => {
          state.eventsLoadingPromise = null;
        });
    }
    return state.eventsLoadingPromise;
  }, [dataPort]);

  const handleOpenEvents = useCallback(async () => {
    setEventsOpen(true);
    try {
      const payload = await ensureEventsLoaded();
      setEventsPayload(payload);
      setEventsStatus(eventsStatusText(payload));
      setOpenEventsText("Xem");
    } catch (_error) {
      // Nội dung lỗi đã được ghi trong ensureEventsLoaded.
    }
  }, [ensureEventsLoaded]);

  // Bản viết lại sự kiện React của bindProtectedDownloadLink từ downloads.js cũ.
  const handleProtectedDownload = useCallback((fallbackNameFactory) => async (event) => {
    const link = event.currentTarget;
    const enabled = link?.getAttribute("aria-disabled") !== "true";
    const url = `${link?.href || ""}`.trim();
    if (!enabled || !url || url.endsWith("#")) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const state = pageStateRef.current;
    const fallbackName = fallbackNameFactory(state.job?.job_id || "job");
    const downloadTarget = await prepareDownloadTarget(fallbackName);
    if (downloadTarget.kind === "aborted") {
      return;
    }
    try {
      showDownloadPreparing(fallbackName);
      const resp = await dataPort.fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Tải xuống thất bại: ${resp.status} ${text || "unknown error"}`);
      }
      const disposition = resp.headers.get("content-disposition") || "";
      const filename = fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("detail-head-note", `Đã bắt đầu lưu ${filename}`);
            completeDownloadToast(filename);
            return;
          }
          updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
        },
      });
    } catch (error) {
      setText("detail-head-note", error.message || "Tải xuống thất bại");
      failDownloadToast(error.message || "Tải xuống thất bại");
    }
  }, [dataPort, setText]);

  return (
    <>
      <main className="detail-page">
        <DetailHeader t={t} links={links} onProtectedDownload={handleProtectedDownload} />
        <section className="detail-grid">
          <JobSummaryCard title="Thông tin chạy">
            <MetaRow label="Giai đoạn hiện tại" id="detail-runtime-current-stage" value={t("detail-runtime-current-stage")} />
            <MetaRow label="Thời lượng giai đoạn hiện tại" id="detail-runtime-stage-elapsed" value={t("detail-runtime-stage-elapsed")} />
            <MetaRow label="Tổng thời lượng" id="detail-runtime-total-elapsed" value={t("detail-runtime-total-elapsed")} />
            <MetaRow label="Số lần thử lại" id="detail-runtime-retry-count" value={t("detail-runtime-retry-count")} />
            <MetaRow label="Lần chuyển gần nhất" id="detail-runtime-last-transition" value={t("detail-runtime-last-transition")} />
            <MetaRow label="Lý do trạng thái cuối" id="detail-runtime-terminal-reason" value={t("detail-runtime-terminal-reason")} />
            <MetaRow label="Giao thức đầu vào" id="detail-runtime-input-protocol" value={t("detail-runtime-input-protocol")} />
            <MetaRow label="Stage Schema" id="detail-runtime-stage-spec-version" value={t("detail-runtime-stage-spec-version")} />
            <MetaRow label="Chế độ công thức" id="detail-runtime-math-mode" value={t("detail-runtime-math-mode")} />
          </JobSummaryCard>
          <JobSummaryCard title="Chẩn đoán lỗi">
            <MetaRow label="Tóm tắt" id="detail-failure-summary" value={t("detail-failure-summary")} />
            <MetaRow label="Phân loại" id="detail-failure-category" value={t("detail-failure-category")} />
            <MetaRow label="Giai đoạn" id="detail-failure-stage" value={t("detail-failure-stage")} />
            <MetaRow label="Nguyên nhân gốc" id="detail-failure-root-cause" value={t("detail-failure-root-cause")} />
            <MetaRow label="Đề xuất" id="detail-failure-suggestion" value={t("detail-failure-suggestion")} />
            <MetaRow label="Nhật ký gần nhất" id="detail-failure-last-log-line" value={t("detail-failure-last-log-line")} />
            <MetaRow label="Có thể thử lại" id="detail-failure-retryable" value={t("detail-failure-retryable")} />
          </JobSummaryCard>
          <ErrorNoticeCard t={t} />
          <ErrorDiagnostics />
          <ArtifactsSection />
          <MarkdownCard t={t} />
          <StageHistoryTriggerCard onOpen={() => setStageHistoryOpen(true)} />
          <EventsTriggerCard buttonText={openEventsText} onOpen={handleOpenEvents} />
        </section>
      </main>
      <StageHistoryModal open={stageHistoryOpen} job={job} onClose={() => setStageHistoryOpen(false)} />
      <EventsModal
        open={eventsOpen}
        eventsPayload={eventsPayload}
        status={eventsStatus}
        onClose={() => setEventsOpen(false)}
      />
      <DownloadToastHost />
    </>
  );
}
