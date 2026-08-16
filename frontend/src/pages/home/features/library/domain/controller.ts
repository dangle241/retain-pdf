// Tập hành động miền thư viện/tài liệu được tách từ composition.js (tái cấu trúc ①).
//
// composition.js chỉ tạo một lần + nối giá trị trả về vào services.library.actions.
//
// Phụ thuộc được chèn qua tham số, không import trực tiếp thứ trong scope composition:
// - documentRef / libraryEventPort / reloadRecentJobs / deleteJob / buildTranslateConfig
// - startPolling: job-runtime bắt đầu theo dõi một job (composition truyền closure, lấy feature lúc gọi)
// - hideStatusArea: không mở vùng trạng thái workflow trang chính khi nối tiến độ im lặng
//
// Hợp đồng nối tiến độ, cố ý tách khỏi selectJob:
// - selectJob (recent-jobs/actions) → mở hộp thoại workflow + startPolling
// - attachJobProgress (controller này) → chỉ startPolling, không hộp thoại, không bật vùng trạng thái chính
//   Dùng cho StatusCard nhúng trong tab "Dịch" của chi tiết sách.

import { createBookDetailDialogStore } from "../detail/book-detail-dialog-store.js";
import type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "../types.js";
import {
  translateDocument,
  deleteDocument,
  patchDocument,
  API_PREFIX,
  APP_EVENTS,
} from "../../../composition/external.js";

type ErrorLike = {
  message?: string;
  status?: number;
} | string | null | undefined;

export function createLibraryController({
  documentRef,
  libraryEventPort,
  reloadRecentJobs,
  removeLibraryDocuments,
  patchLibraryDocumentItem,
  deleteJob,
  buildTranslateConfig,
  startPolling,
  hideStatusArea,
}: LibraryControllerDeps = {}): LibraryController {
  const bookDetailStore = createBookDetailDialogStore();
  const translatingDocumentIds = new Set<string>();

  function dispatchAppEvent(name: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(
        new globalThis.CustomEvent(name, detail === undefined ? undefined : { detail }),
      );
    }
  }

  async function reload(opts?: ReloadRecentJobsOptions) {
    await reloadRecentJobs?.(opts);
  }

  // F4 "Đọc nguyên văn" tài liệu thư viện: không có job, phát openReaderRequested kèm documentId,
  // ReaderDialog dùng document_id mở trình đọc tài liệu nguồn chỉ đọc, cùng hợp đồng sự kiện với đọc đối chiếu từ thẻ.
  function openSourceReader(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    dispatchAppEvent(APP_EVENTS.openReaderRequested, { documentId: normalizedId, pageIdx: null, blockId: "" });
  }

  // F3 "Chỉ lưu, không dịch": backend đã tạo document ngay **khi tải PDF xong**
  // (POST /uploads → upsert_document_from_upload, document_id = hash nội dung),
  // nên "chỉ lưu" không cần API mới; chỉ **không gửi job dịch** và đóng hộp thoại workflow.
  // close() đồng thời resetUploadSession + scheduleRefresh soft trong bindings.
  // Không force refresh thêm để tránh đóng hộp thoại nháy hai lần.
  function storeUploadedDocumentOnly() {
    dispatchAppEvent(APP_EVENTS.closeTranslationWorkflow);
  }

  // Nội dung thân thiện khi dịch lỗi: lỗi backend phổ biến nhất là "chưa cấu hình xác thực OCR/dịch"
  // (như paddle_token is required); thông báo gốc không hữu ích nên đưa gợi ý có thể hành động; các
  // lỗi khác ít nhất phải truyền thông báo backend, không im lặng nữa.
  function friendlyTranslateError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const credentialish = /(token|key|\u51ed\u636e|\u4ee4\u724c|\u5bc6\u94a5|credential)/i.test(message);
    const missing = /(required|\u9700\u8981|\u7f3a|\u672a\u914d\u7f6e|not configured|missing)/i.test(message);
    if (credentialish && missing) {
      return "Để dịch, trước tiên hãy cấu hình thông tin xác thực OCR / dịch trong “Cài đặt”.";
    }
    return message || "Không thể bắt đầu dịch, vui lòng thử lại sau.";
  }

  // F5 "Dịch sau" tài liệu thư viện: dùng lại upload đã lưu để tạo job dịch book; backend điền
  // active_job_id; sau đó tải lại toàn trang một lần để tài liệu vào lưới với job_id thật và engine
  // poll hiện có (active-refresh lấy payload theo job_id) tự nhiên tiếp quản tiến độ.
  //
  // Khi lỗi, **ném cho bên gọi** để hộp thoại chi tiết setError bên trong và không đóng.
  // Trước đây renderError vào lưới, nhưng entry dịch đã chuyển từ thẻ vào hộp thoại, còn thanh lỗi lưới chỉ hiển thị khi
  // "lưới trống"; khi lưới có dữ liệu người dùng không thấy, tạo cảm giác "bấm không phản hồi" khi thiếu
  // xác thực OCR; đây là lỗi thật.
  // Ghép cấu hình job thật gửi backend: trước tiên tạo nền ocr (PaddleOCR) +
  // translation (DeepSeek) đầy đủ từ xác thực đã cấu hình bằng buildTranslateConfig, rồi chồng phạm vi trang từ hộp thoại
  // (payload.ocr.page_ranges / payload.translation.start_page-end_page).
  // Nếu không gửi xác thực, backend không nhận provider và mặc định sang OCR provider đã ngừng, gây lỗi.
  function assembleTranslatePayload(overrides: TranslateDocumentPayload = {}): TranslateDocumentPayload {
    const pageRanges = `${overrides?.ocr?.page_ranges || ""}`.trim();
    const base = (buildTranslateConfig?.(pageRanges) || {}) as TranslateDocumentPayload;
    return {
      ...(base.ocr ? { ocr: { ...base.ocr, ...(overrides.ocr || {}) } } : (overrides.ocr ? { ocr: overrides.ocr } : {})),
      ...(base.translation ? { translation: { ...base.translation, ...(overrides.translation || {}) } } : (overrides.translation ? { translation: overrides.translation } : {})),
    };
  }

  /**
   * Nối tiến độ tác vụ im lặng (tab Dịch chi tiết sách → bd-job-status-inner).
   * - startPolling silent: chỉ ghi statusCardStore, không mở vùng workflow hay phát create.
   * - Không bao giờ dispatch openTranslationWorkflow vì tiến độ chính ở chi tiết, không ở hộp thoại.
   * - Buộc ẩn vùng trạng thái chính để #status-section / StatusCard chính không tranh hiển thị.
   */
  function attachJobProgress(jobId?: string | null) {
    const id = `${jobId || ""}`.trim();
    if (!id || id.startsWith("doc:")) {
      return;
    }
    hideStatusArea?.();
    startPolling?.(id, { silent: true, showWorkflow: false, publishLibrary: false });
    hideStatusArea?.();
  }

  /**
   * Phản hồi ngay sau khi bắt đầu dịch thành công, không chờ tải lại toàn trang:
   * 1) Payload chi tiết gắn ngay job_id thật → tab Dịch chuyển sang StatusCard.
   * 2) attachJobProgress → vòng tiến độ/luồng giai đoạn chạy ngay.
   * 3) publishJobUpdated cập nhật thẻ gốc tại chỗ theo document_id, cấm chèn thẻ thứ hai.
   * 4) Làm mới silent nền để đồng bộ máy chủ, không nháy loading.
   */
  function promoteDocumentToJob(
    documentId: string,
    result: JobSubmissionView | null | undefined,
  ) {
    const jobId = `${result?.job_id || result?.id || ""}`.trim();
    if (!jobId) {
      return;
    }
    const dialogState = bookDetailStore.getState();
    const base = (dialogState.payload || {}) as LibraryCardItem;
    const status = `${result?.status || "queued"}`.trim() || "queued";
    const stage = `${result?.stage || result?.display_stage || "queued"}`.trim() || "queued";

    if (dialogState.open && `${base.document_id || ""}`.trim() === documentId) {
      bookDetailStore.open({
        ...base,
        job_id: jobId,
        active_job_id: jobId,
        library_only: false,
        status,
        stage,
        display_stage: `${result?.display_stage || stage}`,
      });
    }

    // Dùng JobUpdated để sửa thẻ gốc tại chỗ theo document_id, cấm trang chính chèn sách mới.
    const previousJobId = `${base.job_id || ""}`.trim();
    libraryEventPort?.publishJobUpdated?.({
      job_id: jobId,
      source_job_id: previousJobId && previousJobId !== jobId ? previousJobId : undefined,
      document_id: documentId,
      active_job_id: jobId,
      library_only: false,
      status,
      stage,
      display_stage: `${result?.display_stage || stage}`,
      title: base.title,
      display_name: base.display_name || base.title,
      page_count: base.page_count,
      cover_url: base.cover_url,
      thumbnail_url: base.thumbnail_url,
    });
    attachJobProgress(jobId);
  }

  async function translateLibraryDocument(
    documentId?: string | null,
    payload: TranslateDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId || translatingDocumentIds.has(normalizedId)) {
      return null;
    }
    translatingDocumentIds.add(normalizedId);
    let result: JobSubmissionView | null = null;
    try {
      result = (await translateDocument(
        API_PREFIX,
        normalizedId,
        assembleTranslatePayload(payload),
      )) as JobSubmissionView;
    } catch (error) {
      throw new Error(friendlyTranslateError(error as ErrorLike));
    } finally {
      translatingDocumentIds.delete(normalizedId);
    }

    // Nối tiến độ + cập nhật chi tiết/lưới ngay; không tải lại toàn trang, khi chạy tiến triển bằng patch một thẻ.
    promoteDocumentToJob(normalizedId, result);
    return result;
  }

  // Xóa cấp tài liệu sau khi backend thêm DELETE /documents/:id: xóa document + mọi
  // job/upload/tệp thuộc nó. Tài liệu thư viện và đã dịch dùng chung luồng này vì thẻ đều có document_id.
  function friendlyDocumentDeleteError(error: ErrorLike) {
    const message = typeof error === "string" ? error : `${error?.message || error || ""}`;
    const status = typeof error === "object" && error ? error.status : undefined;
    if (status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
        ? `Tài liệu này có ${count} mục yêu thích; vui lòng xóa các mục đó trước khi xóa tài liệu.`
        : "Tài liệu đang được mục yêu thích tham chiếu; vui lòng xóa các mục liên quan trước khi xóa tài liệu.";
    }
    return message || "Không thể xóa tài liệu";
  }

  // Giống dịch: lỗi ném cho bên gọi để hiển thị trong hộp thoại. Thành công thì xóa thẻ lạc quan + soft reload im lặng,
  // không await loading toàn trang không silent, một nguyên nhân trang chính nháy trống.
  async function deleteLibraryDocument(documentId?: string | null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return;
    }
    try {
      await deleteDocument(API_PREFIX, normalizedId);
    } catch (error) {
      throw new Error(friendlyDocumentDeleteError(error as ErrorLike));
    }
    removeLibraryDocuments?.([normalizedId]);
    void reload({ reset: true, silent: true });
  }

  // Xóa hàng loạt: API vẫn xóa từng mục; lưới xóa lạc quan một lần + một silent soft reload.
  async function deleteLibraryDocuments(
    documentIds: Array<string | null | undefined> = [],
  ): Promise<DeleteDocumentsResult> {
    const ids = [...new Set((documentIds || []).map((id) => `${id || ""}`.trim()).filter(Boolean))];
    if (!ids.length) {
      return { confirmed: 0, failed: 0 };
    }
    const results = await Promise.allSettled(ids.map((id) => deleteDocument(API_PREFIX, id)));
    const confirmedIds = ids.filter((_, index) => results[index]?.status === "fulfilled");
    const confirmed = confirmedIds.length;
    if (confirmedIds.length) {
      removeLibraryDocuments?.(confirmedIds);
    }
    void reload({ reset: true, silent: true });
    return { confirmed, failed: results.length - confirmed };
  }

  // Entry xóa thẻ: có document_id thì xóa cấp tài liệu, gồm toàn tài liệu + mọi job;
  // nếu không, trường hợp hiếm mục job được chèn runtime, lùi về xóa job cũ để giữ hành vi.
  function deleteCard(target: DeleteCardTarget = {}) {
    const documentId = `${target?.documentId || ""}`.trim();
    if (documentId) {
      // fire-and-forget: deleteLibraryDocument giờ có thể throw; nuốt để tránh rejection chưa xử lý
      // (entry cấp thẻ hiện không có bên dùng; xóa thẻ đã gộp vào hộp thoại chi tiết).
      void deleteLibraryDocument(documentId).catch(() => {});
      return;
    }
    deleteJob?.(`${target?.jobId || ""}`.trim());
  }

  function shouldPreferTranslateTab(item?: LibraryCardItem | null) {
    if (item?.prefer_translate_tab) return true;
    const status = `${item?.status || ""}`.trim().toLowerCase();
    if (status === "failed" || status === "running" || status === "queued" || status === "pending") {
      return true;
    }
    const jobId = `${item?.job_id || item?.active_job_id || ""}`.trim();
    // Có job thật và không phải id tổng hợp thư viện → mặc định xem tiến độ tab Dịch.
    if (jobId && !jobId.startsWith("doc:") && !item?.library_only) {
      return true;
    }
    return false;
  }

  // Hộp thoại chi tiết sách mở khi bấm thẻ. Đang chạy/lỗi mặc định vào tab Dịch + tiến độ silent,
  // không bao giờ mở #translation-workflow-dialog.
  function openBookDetail(item?: LibraryCardItem | null) {
    if (!item) return;
    const documentId = `${item.document_id || ""}`.trim();
    const jobId = `${item.job_id || item.active_job_id || ""}`.trim();
    // Phải có ít nhất document_id hoặc job_id thật.
    if (!documentId && (!jobId || jobId.startsWith("doc:"))) {
      return;
    }
    const prefer = shouldPreferTranslateTab(item);
    bookDetailStore.open({
      ...item,
      prefer_translate_tab: prefer || Boolean(item.prefer_translate_tab),
    });
    if (jobId && !jobId.startsWith("doc:")) {
      attachJobProgress(jobId);
    }
  }

  /**
   * "Chọn tác vụ" trong lưới: luôn vào tab Dịch chi tiết + tiến độ silent.
   * Không lùi về openTranslationWorkflow; hộp thoại cũ chỉ dành cho nút "Thêm" ở đáy.
   */
  function selectJobForDetail(
    jobId?: string | null,
    options: {
      findItem?: (jobId: string) => LibraryCardItem | null | undefined;
      /** @deprecated Lưới thư viện không còn bật workflow; giữ tham số để tương thích injection test. */
      fallbackSelectJob?: (jobId: string) => void;
    } = {},
  ) {
    const id = `${jobId || ""}`.trim();
    if (!id) {
      return;
    }
    const item = options.findItem?.(id) || null;
    if (item) {
      openBookDetail({
        ...item,
        prefer_translate_tab: true,
      });
      return;
    }
    // Tạm không tìm thấy dòng trong lưới: vẫn dùng job_id mở vỏ chi tiết + poll silent, không bật cửa sổ cũ.
    openBookDetail({
      job_id: id,
      prefer_translate_tab: true,
      status: "running",
    });
  }

  // Sửa tiêu đề/nhãn/trạng thái đọc trong hộp thoại: sau PATCH ghi lạc quan lưới/chi tiết rồi đồng bộ silent soft nền.
  async function updateLibraryDocument(
    documentId?: string | null,
    payload: UpdateDocumentPayload = {},
  ): Promise<unknown> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return null;
    }
    const updated = await patchDocument(API_PREFIX, normalizedId, payload) as Record<string, unknown> | null;
    const patch: Partial<LibraryCardItem> = {
      ...(payload.title !== undefined
        ? {
          title: `${updated?.title ?? payload.title ?? ""}`,
          display_name: `${updated?.title ?? payload.title ?? ""}`,
        }
        : {}),
      ...(payload.reading_status !== undefined
        ? { reading_status: `${updated?.reading_status ?? payload.reading_status ?? ""}` }
        : {}),
      ...(payload.tags !== undefined
        ? { tags: (Array.isArray(updated?.tags) ? updated.tags : payload.tags) as string[] }
        : {}),
    };
    if (Object.keys(patch).length) {
      patchLibraryDocumentItem?.(normalizedId, patch);
      const dialogState = bookDetailStore.getState();
      const base = dialogState.payload;
      if (dialogState.open && base && `${base.document_id || ""}`.trim() === normalizedId) {
        bookDetailStore.open({ ...base, ...patch });
      }
    }
    void reload({ reset: true, silent: true });
    return updated;
  }

  return {
    bookDetailStore,
    // Tên khóa khớp hợp đồng hiện có services.library.actions để bên dùng RecentJobsLibrary /
    // BookDetailDialog / CategoriesView không cần sửa.
    openSourceReader,
    storeOnly: storeUploadedDocumentOnly,
    translateDocument: translateLibraryDocument,
    deleteDocument: deleteLibraryDocument,
    deleteDocuments: deleteLibraryDocuments,
    deleteCard,
    openBookDetail,
    selectJobForDetail,
    updateDocument: updateLibraryDocument,
    /** Tiến độ nhúng chi tiết: poll im lặng, không bật #translation-workflow-dialog. */
    attachJobProgress,
  };
}
