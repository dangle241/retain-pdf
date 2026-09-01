import { withTimeout } from "../../utils/async-timeout.js";
import { buildErrorDiagnostic } from "../../utils/error-diagnostics.js";
import {
  getUploadStatePort,
  type UploadPayload,
  type UploadState,
  type UploadStatePort,
} from "./state.js";
import { defaultUploadConfigPort } from "./config-port.js";

export interface ConstrainPageRangesOptions {
  source?: string;
}

export interface UploadViewPort {
  clearPageRanges: () => void;
  markUploadReady: (ready: boolean) => void;
  readPageRanges: () => { start: string; end: string };
  writePageRanges: (ranges: { start?: string; end?: string }) => void;
  setInlinePageRangeVisible: (visible: boolean) => void;
  openPageRangeDialog: (options: { applied?: string; maxPage?: number }) => void;
  closePageRangeDialog: () => void;
  selectedFile: () => File | null;
  setFileLabel: (file: File | null, defaultFileLabel: string) => void;
  showUploadStatus: (message: string) => void;
}

export interface UploadConfigPortLike {
  buildUploadUrl: (apiPrefix?: string) => string;
}

export interface UploadResponsePayload {
  page_count?: number;
  upload_id?: string;
  filename?: string;
  bytes?: number;
  [key: string]: unknown;
}

export interface MountUploadFeatureOptions {
  state?: unknown;
  uploadStatePort?: Partial<UploadStatePort> | UploadStatePort | null;
  apiBase?: string;
  apiPrefix?: string;
  frontMaxBytes: number;
  frontMaxPageCount: number;
  countPdfPages?: (file: File) => Promise<number> | number;
  defaultFileLabel: string;
  collectUploadFormData: (file: File) => FormData | unknown;
  submitUploadRequest: (
    url: string,
    formData: unknown,
    setProgress?: (loaded: number, total: number) => void,
  ) => Promise<UploadResponsePayload>;
  resetUploadedFile?: () => void;
  resetUploadProgress?: () => void;
  setUploadProgress?: (loaded: number, total: number) => void;
  clearFileInputValue?: () => void;
  setText: (id: string, value?: unknown) => void;
  applyWorkflowMode: () => void;
  refreshSubmitControls: () => void;
  refreshDeepSeekBalance?: ((options?: {
    silent?: boolean;
  }) => Promise<{ status?: string } | unknown>) | null;
  workflowNeedsUpload: (workflow?: string) => boolean;
  configPort?: UploadConfigPortLike;
  viewPort: UploadViewPort;
}

export function mountUploadFeature({
  state,
  uploadStatePort,
  apiBase,
  apiPrefix,
  frontMaxBytes,
  frontMaxPageCount,
  countPdfPages,
  defaultFileLabel,
  collectUploadFormData,
  submitUploadRequest,
  resetUploadedFile,
  resetUploadProgress,
  setUploadProgress,
  clearFileInputValue,
  setText,
  applyWorkflowMode,
  refreshSubmitControls,
  refreshDeepSeekBalance,
  workflowNeedsUpload,
  configPort = defaultUploadConfigPort,
  viewPort,
}: MountUploadFeatureOptions) {
  const BALANCE_CHECK_TIMEOUT_MS = 12000;
  const uploadState = uploadStatePort || getUploadStatePort();

  function emptyUploadState(): UploadState {
    return {
      uploadId: "",
      uploadedFileName: "",
      uploadedPageCount: 0,
      uploadedBytes: 0,
      appliedPageRange: "",
      submitBusy: false,
    };
  }

  function readUploadState(): UploadState {
    return uploadState.getSnapshot?.() || emptyUploadState();
  }

  function updateUploadState(payload: UploadPayload = {}) {
    return uploadState.setUpload?.(payload) || readUploadState();
  }

  function updateAppliedPageRange(value = "") {
    return uploadState.setAppliedPageRange?.(value) || readUploadState();
  }

  function resetAppliedPageRange() {
    return uploadState.clearAppliedPageRange?.() || readUploadState();
  }

  function resetUploadSession() {
    const snapshot = uploadState.reset?.() || readUploadState();
    resetUploadedFile?.();
    resetUploadProgress?.();
    clearFileInputValue?.();
    viewPort.clearPageRanges();
    viewPort.markUploadReady(false);
    renderPageRangeSummary();
    refreshSubmitControls();
    return snapshot;
  }

  function formatByteLimit(bytes) {
    const mb = Number(bytes) / (1024 * 1024);
    return Number.isFinite(mb) && mb > 0 ? `${Math.round(mb)}MB` : "Current";
  }

  function normalizePageRangeValue(startValue = "", endValue = "") {
    const start = startValue.trim();
    const end = endValue.trim();
    if (!start && !end) {
      return "";
    }
    if (start && end) {
      return start === end ? start : `${start}-${end}`;
    }
    return start || end;
  }

  function currentPageRanges() {
    const { start, end } = viewPort.readPageRanges();
    return normalizePageRangeValue(start, end);
  }

  function pageRangeLimit() {
    const snapshot = readUploadState();
    return Number(snapshot.uploadedPageCount || 0) || frontMaxPageCount || 0;
  }

  function normalizePageNumberInput(value) {
    const text = `${value ?? ""}`.trim();
    if (!text) {
      return "";
    }
    const page = Number(text);
    if (!Number.isFinite(page)) {
      return "";
    }
    return Math.max(1, Math.trunc(page));
  }

  function constrainPageRanges({ source = "" }: ConstrainPageRangesOptions = {}) {
    const { start: rawStart, end: rawEnd } = viewPort.readPageRanges();
    const maxPage = pageRangeLimit();
    let start = normalizePageNumberInput(rawStart);
    let end = normalizePageNumberInput(rawEnd);

    if (maxPage > 0) {
      if (start !== "") {
        start = Math.min(Number(start), maxPage);
      }
      if (end !== "") {
        end = Math.min(Number(end), maxPage);
      }
    }

    if (start !== "" && end !== "" && start > end) {
      if (source === "end") {
        end = start;
      } else {
        start = end;
      }
    }

    const next = {
      start: start === "" ? "" : `${start}`,
      end: end === "" ? "" : `${end}`,
    };
    viewPort.writePageRanges(next);
    updateAppliedPageRange(normalizePageRangeValue(next.start, next.end));
    refreshSubmitControls();
    return { ...next, maxPage };
  }

  function validatePageRanges() {
    const { start: rawStart, end: rawEnd } = viewPort.readPageRanges();
    const start = rawStart.trim();
    const end = rawEnd.trim();
    const maxPage = pageRangeLimit();
    if ((start && Number(start) < 1) || (end && Number(end) < 1)) {
      setText("error-box", "Page numbers must start at 1");
      return false;
    }
    if ((start && maxPage && Number(start) > maxPage) || (end && maxPage && Number(end) > maxPage)) {
      setText("error-box", `Page number cannot exceed ${maxPage}`);
      return false;
    }
    if (start && end && Number(start) > Number(end)) {
      setText("error-box", "Start page cannot be greater than end page");
      return false;
    }
    if (maxPage && start && end && Number(end) - Number(start) + 1 > maxPage) {
      setText("error-box", `Page range cannot exceed ${maxPage} pages`);
      return false;
    }
    updateAppliedPageRange(normalizePageRangeValue(start, end));
    return true;
  }

  function renderPageRangeSummary() {
    const snapshot = readUploadState();
    viewPort.setInlinePageRangeVisible(workflowNeedsUpload() && Boolean(snapshot.uploadId));
  }

  function openPageRangeDialog() {
    const snapshot = readUploadState();
    viewPort.openPageRangeDialog({
      applied: snapshot.appliedPageRange || "",
      maxPage: pageRangeLimit(),
    });
  }

  function applyPageRanges() {
    viewPort.closePageRangeDialog();
  }

  function clearPageRanges() {
    viewPort.clearPageRanges();
    resetAppliedPageRange();
    renderPageRangeSummary();
    refreshSubmitControls();
    viewPort.closePageRangeDialog();
  }

  async function handleFileSelected() {
    const file = viewPort.selectedFile();
    uploadState.reset?.();
    resetUploadedFile();
    resetUploadProgress();
    viewPort.clearPageRanges();
    renderPageRangeSummary();
    applyWorkflowMode();
    viewPort.setFileLabel(file, defaultFileLabel);
    if (!file) {
      return;
    }
    if (file.size > frontMaxBytes) {
      setText("error-box", `The current frontend limit is ${formatByteLimit(frontMaxBytes)} for PDF files`);
      viewPort.showUploadStatus("File exceeds size limit");
      return;
    }
    if (frontMaxPageCount && countPdfPages) {
      viewPort.showUploadStatus("Checking pages...");
      try {
        const localPageCount = await countPdfPages(file);
        if (!Number.isFinite(localPageCount) || localPageCount <= 0) {
          setText("error-box", "PDF parsing failed. Check whether the file is corrupted or inaccessible.");
          viewPort.showUploadStatus("File validation failed");
          clearFileInputValue();
          return;
        }
        if (localPageCount > frontMaxPageCount) {
          setText("error-box", `PDF page count exceeds the limit: max ${frontMaxPageCount} pages`);
          viewPort.showUploadStatus("File exceeds page limit");
          clearFileInputValue();
          return;
        }
      } catch (err) {
        setText("error-box", buildErrorDiagnostic(err, {
          operation: "Validate PDF file",
          details: {
            file_name: file.name,
            file_size: file.size,
            max_pages: frontMaxPageCount,
          },
        }));
        viewPort.showUploadStatus("File validation failed");
        clearFileInputValue();
        return;
      }
    }
    setText("error-box", "-");
    viewPort.showUploadStatus("Uploading...");

    const uploadUrl = configPort.buildUploadUrl(apiPrefix);
    try {
      const payload = await submitUploadRequest(
        uploadUrl,
        collectUploadFormData(file),
        setUploadProgress,
      );
      const uploadedPageCount = Number(payload.page_count || 0);
      if (frontMaxPageCount > 0 && uploadedPageCount > frontMaxPageCount) {
        setText("error-box", `PDF page count exceeds the limit: max ${frontMaxPageCount} pages`);
        viewPort.showUploadStatus("File exceeds page limit");
        clearFileInputValue();
        resetUploadedFile();
        return;
      }
      const snapshot = updateUploadState({
        uploadId: payload.upload_id || "",
        uploadedFileName: payload.filename || file.name,
        uploadedPageCount,
        uploadedBytes: Number(payload.bytes || file.size || 0),
      });
      viewPort.writePageRanges({
        start: uploadedPageCount > 0 ? "1" : "",
        end: uploadedPageCount > 0 ? `${uploadedPageCount}` : "",
      });
      updateAppliedPageRange(currentPageRanges());
      viewPort.markUploadReady(!!snapshot.uploadId);
      viewPort.showUploadStatus("Upload complete: start translation or keep it in the library.");
      clearFileInputValue();
      renderPageRangeSummary();
      refreshSubmitControls();
      if (refreshDeepSeekBalance) {
        viewPort.showUploadStatus("Upload complete. Checking balance...");
        void withTimeout(
          refreshDeepSeekBalance({ silent: true }),
          BALANCE_CHECK_TIMEOUT_MS,
          "DeepSeek balance check timed out",
        )
          .then((result) => {
            const status = `${(result as { status?: string } | null | undefined)?.status || ""}`;
            if (status === "network_error" || status === "missing_key") {
              viewPort.showUploadStatus("Upload complete. Balance is not confirmed and will be checked again before submission.");
              return;
            }
            viewPort.showUploadStatus("Upload complete. You can start the job.");
          })
          .catch(() => {
            viewPort.showUploadStatus("Upload complete. Balance is not confirmed and will be checked again before submission.");
          })
          .finally(() => {
            refreshSubmitControls();
          });
      }
    } catch (err) {
      resetUploadedFile();
      clearFileInputValue();
      setText("error-box", buildErrorDiagnostic(err, {
        operation: "Upload PDF Files",
        url: uploadUrl,
        details: {
          file_name: file.name,
          file_size: file.size,
          max_pages: frontMaxPageCount,
        },
      }));
      viewPort.showUploadStatus("UploadFailed");
      applyWorkflowMode();
    }
  }

  return {
    applyPageRanges,
    clearPageRanges,
    constrainPageRanges,
    currentPageRanges,
    handleFileSelected,
    normalizePageRangeValue,
    openPageRangeDialog,
    renderPageRangeSummary,
    resetUploadSession,
    validatePageRanges,
  };
}


