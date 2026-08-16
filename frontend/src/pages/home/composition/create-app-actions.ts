// app-actions (gửi tác vụ / thư mục đầu ra desktop).

import {
  API_PREFIX,
  openDesktopOutputDirectory,
  mountAppActionsFeature,
  defaultAppActionsConfigPort,
  createAppActionsRuntimeEnvPort,
  submitJobRequest,
  syncCurrentJobSnapshot,
  buildApiEndpoint,
} from "./external.js";
import type {
  AppActionsFeature,
  HomeBridge,
  HomeFeatures,
  UploadStatePort,
} from "./types.js";

type WorkflowViewPort = {
  setSubmitBusy: (busy: boolean) => void;
  setSubmitDisabled: (disabled: boolean) => void;
};

type UploadViewPort = {
  resetUploadedFileView: () => void;
};

type StatusCardPresenterPort = {
  renderMain: () => void;
};

type LibraryEventPort = {
  requestRefresh?: (opts?: unknown) => void;
};

type SettingsHubDialogStore = {
  open: (payload?: { tab?: string } | null) => void;
};

type CreateAppActionsArgs = {
  features: HomeFeatures;
  bridge: Pick<HomeBridge, "resetUploadedFile">;
  setText: (id: string, value?: string) => void;
  workflowView: WorkflowViewPort;
  uploadView: UploadViewPort;
  uploadStatePort: UploadStatePort;
  legacyState: Record<string, unknown>;
  jobRuntimeState: Record<string, unknown>;
  statusCardPresenter: StatusCardPresenterPort;
  libraryEventPort: LibraryEventPort;
  /** Entry xác thực thông thường: mở Cài đặt → API để tránh hai luồng với hộp thoại cấu hình đầu tiên. */
  settingsHubDialogStore?: SettingsHubDialogStore | null;
};

export function createAppActions({
  features,
  bridge,
  setText,
  workflowView,
  uploadView,
  uploadStatePort,
  legacyState,
  jobRuntimeState,
  statusCardPresenter,
  libraryEventPort,
  settingsHubDialogStore = null,
}: CreateAppActionsArgs): { appActionsFeature: AppActionsFeature } {
  const jobSnapshotPort = Object.freeze({
    syncCurrentJobSnapshot: (
      payload: unknown,
      jobId: unknown,
      meta?: { startedAt?: string; finishedAt?: string },
    ) => (
      syncCurrentJobSnapshot(jobRuntimeState, payload, jobId, meta)
    ),
  });

  const viewPort = {
    setSubmitBusyState: (busy: boolean) => workflowView.setSubmitBusy(busy),
    resetMissingUpload: () => {
      uploadStatePort.reset({ includePageRange: false });
      workflowView.setSubmitDisabled(true);
      uploadView.resetUploadedFileView();
      setText("error-box", "Tệp đã tải lên không còn hiệu lực; vui lòng tải lại PDF rồi gửi.");
    },
  };

  // credentials / workflow đã được gắn vào features trước khi gọi hàm này.
  const creds = () => features.browserCredentialsFeature;
  const workflow = () => features.workflowFeature;
  const upload = () => features.uploadFeature;
  const jobRuntime = () => features.jobRuntimeFeature;

  // configPort có thể thay apiBase; chữ ký lớp dưới vẫn đánh dấu bắt buộc.
  const appActionsFeature = mountAppActionsFeature({
    state: jobRuntimeState,
    uploadStatePort,
    runtimeEnvPort: createAppActionsRuntimeEnvPort(legacyState),
    jobSnapshotPort,
    viewPort,
    configPort: defaultAppActionsConfigPort,
    apiPrefix: API_PREFIX,
    buildApiEndpoint,
    setText,
    openDesktopOutputDirectory,
    resetUploadedFile: bridge.resetUploadedFile,
    submitFlow: {
      openSetupDialog: () => creds().openBrowserCredentialsDialog({ setupMode: true }),
      renderJob: statusCardPresenter.renderMain,
      submitJobRequest,
      currentWorkflow: () => workflow().currentWorkflow(),
      workflowNeedsCredentials: (w?: string) => workflow().workflowNeedsCredentials(w),
      workflowNeedsUpload: (w?: string) => workflow().workflowNeedsUpload(w),
      currentRenderSourceJobId: () => workflow().currentRenderSourceJobId(),
      currentBudgetState: (w?: string) => workflow().currentBudgetState(w),
      collectRunPayload: () => workflow().collectRunPayload(),
      validateBeforeSubmit: () => upload().validatePageRanges() ?? true,
      ensureOcrCredentialsReady: (options?: unknown) => creds().ensureOcrCredentialsReady(options),
      hasBrowserCredentials: () => Boolean(creds().hasBrowserCredentials()),
      openBrowserCredentialsDialog: (options?: unknown) => {
        const opts = (options && typeof options === "object" ? options : {}) as { setupMode?: boolean };
        if (opts.setupMode) {
          creds().openBrowserCredentialsDialog({ setupMode: true });
          return;
        }
        // Thiếu Key thông thường: Cài đặt → API, nhất quán với định tuyến sự kiện UI.
        if (settingsHubDialogStore?.open) {
          settingsHubDialogStore.open({ tab: "api" });
          return;
        }
        creds().openBrowserCredentialsDialog(opts);
      },
      refreshDeepSeekBalance: (options?: unknown) => creds().refreshDeepSeekBalance(options),
      startJobPolling: (jobId: string) => jobRuntime().startPolling(jobId),
      libraryEventPort,
      jobSnapshotPort,
    },
  }) as AppActionsFeature;

  return { appActionsFeature };
}
