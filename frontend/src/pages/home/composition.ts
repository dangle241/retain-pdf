// Home page composition root: only "wire in order"; no business, no import pile.
//
// Rules:
//   1. All ../../../js/* only in composition/external.ts
//   2. Each create* factory returns its own bag; assign explicitly here; no Object.assign(ctx)
//   3. features is the only mutable registry; late binding goes through it
//   4. job-runtime / recent-jobs / artifacts are mounted once at the composition stage

import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
  createDeveloperState,
  setDeveloperConfig,
  createDesktopState,
  setDesktopMode,
  createHomeStatePort,
  createUploadStatePort,
  defaultCredentialsStatePort,
  validateDeepSeekToken,
  queryDeepSeekBalance,
  createTranslationWorkflowDialogStatePort,
  fetchGlossariesApi,
  fetchGlossaryApi,
  createGlossaryApi,
  updateGlossaryApi,
  deleteGlossaryApi,
  exportGlossaryCsvApi,
  parseGlossaryCsvApi,
  submitUploadRequestHttp,
  fetchLatestGithubRelease,
  defaultUpdateCachePort,
} from "./composition/external.js";

import { createHomeTextStore } from "./state/text-store.js";
import { createUploadViewFeature } from "./features/upload/upload-view-store.js";
import { createWorkflowViewFeature } from "./features/workflow/workflow-view-store.js";
import { createStatusAreaFeature } from "./features/status/status-area.js";
import { createTranslationWorkflowDialogRuntime } from "./features/workflow/translation-workflow-dialog-runtime.js";

import { safeLoad } from "./composition/safe-load.js";
import { createBridge } from "./composition/create-bridge.js";
import { createWorkflowAndUpload } from "./composition/create-workflow-upload.js";
import { createCredentials } from "./composition/create-credentials.js";
import { createGlossariesAndAppUpdate } from "./composition/create-glossaries-app-update.js";
import { createStatusDomain } from "./composition/create-status-domain.js";
import { createLibraryDomain } from "./composition/create-library-domain.js";
import { createAppActions } from "./composition/create-app-actions.js";
import { createRuntimeFeatures } from "./composition/create-runtime-features.js";
import { createLifecycle } from "./composition/create-lifecycle.js";
import { buildHomeServices } from "./composition/build-home-services.js";
import type {
  CreateHomeCompositionOptions,
  HomeFeatures,
  HomeServices,
  StatusDetailHolder,
} from "./composition/types.js";

export type { HomeServices, HomeFeatures, CreateHomeCompositionOptions } from "./composition/types.js";

export function createHomeComposition({
  documentRef = globalThis.document,
  fetchGlossaries = fetchGlossariesApi,
  submitUploadRequest = submitUploadRequestHttp,
  loadPersistedDeveloperConfig = () => safeLoad(loadDeveloperStoredConfig, {}),
  loadPersistedBrowserConfig = () => safeLoad(loadBrowserStoredConfig, {}),
  validateOcrToken: validateOcrTokenOverride = null,
  validateDeepSeekToken: validateDeepSeekTokenOverride = validateDeepSeekToken,
  queryDeepSeekBalance: queryDeepSeekBalanceOverride = queryDeepSeekBalance,
  checkApiConnectivity: checkApiConnectivityOverride = null,
  saveDesktopConfig: saveDesktopConfigOverride = null,
  initialDesktopMode = false,
  fetchGlossary: fetchGlossaryOverride = fetchGlossaryApi,
  createGlossary: createGlossaryOverride = createGlossaryApi,
  updateGlossary: updateGlossaryOverride = updateGlossaryApi,
  deleteGlossary: deleteGlossaryOverride = deleteGlossaryApi,
  exportGlossaryCsv: exportGlossaryCsvOverride = exportGlossaryCsvApi,
  parseGlossaryCsv: parseGlossaryCsvOverride = parseGlossaryCsvApi,
  fetchLatestRelease: fetchLatestReleaseOverride = fetchLatestGithubRelease,
  appUpdateCachePort: appUpdateCachePortOverride = defaultUpdateCachePort,
  appUpdateAutoCheckEnabled = false,
}: CreateHomeCompositionOptions = {}): HomeServices {
  const features: HomeFeatures = {};

  // —— Basic state / view ——
  const legacyState = { ...createDeveloperState(), ...createDesktopState() };
  setDeveloperConfig(legacyState, loadPersistedDeveloperConfig());
  setDesktopMode(legacyState, initialDesktopMode);

  const homeStatePort = createHomeStatePort({}, { eventTarget: documentRef });
  const uploadStatePort = createUploadStatePort();
  const credentialsStatePort = defaultCredentialsStatePort;
  credentialsStatePort.setCredentials(loadPersistedBrowserConfig());

  const textStore = createHomeTextStore();
  const uploadView = createUploadViewFeature();
  // Lower view/runtime factories' default `= {}` makes TS drop fields that have no defaults; runtime args are correct, so loosen here.
  const workflowView = createWorkflowViewFeature({
    uploadTilePort: uploadView.uploadTilePort,
  } as any);
  const statusArea = createStatusAreaFeature({ documentRef });
  const dialogStatePort = createTranslationWorkflowDialogStatePort({ homeStatePort });
  const workflowDialog = createTranslationWorkflowDialogRuntime({
    dialogStatePort,
    statusAreaPort: statusArea.statusAreaPort,
    uploadSessionPort: {
      resetUploadSession: () => features.uploadFeature.resetUploadSession(),
    },
    documentRef,
  } as any);

  // bridge requires a statusDetail holder (written later by createStatusDomain)
  const statusDetailHolder: StatusDetailHolder = { store: null, dialogStore: null };
  const bridge = createBridge({
    textStore,
    statusArea,
    workflowView,
    uploadView,
    uploadStatePort,
    features,
    statusDetail: statusDetailHolder,
  });

  // —— Domains (return a bag, hang it on features explicitly) ——
  Object.assign(features, createWorkflowAndUpload({
    features,
    credentialsStatePort,
    workflowView,
    uploadView,
    uploadStatePort,
    bridge,
    legacyState,
    setText: bridge.setText,
    fetchGlossaries,
    submitUploadRequest,
  }));

  const credentials = createCredentials({
    features,
    legacyState,
    credentialsStatePort,
    uploadStatePort,
    validateOcrTokenOverride,
    validateDeepSeekTokenOverride,
    queryDeepSeekBalanceOverride,
    checkApiConnectivityOverride,
    saveDesktopConfigOverride,
  });
  features.browserCredentialsFeature = credentials.browserCredentialsFeature;

  const glossaries = createGlossariesAndAppUpdate({
    features,
    fetchGlossaries,
    fetchGlossary: fetchGlossaryOverride,
    createGlossary: createGlossaryOverride,
    updateGlossary: updateGlossaryOverride,
    deleteGlossary: deleteGlossaryOverride,
    exportGlossaryCsv: exportGlossaryCsvOverride,
    parseGlossaryCsv: parseGlossaryCsvOverride,
    appUpdateAutoCheckEnabled,
    appUpdateCachePort: appUpdateCachePortOverride,
    fetchLatestRelease: fetchLatestReleaseOverride,
  });
  features.glossariesFeature = glossaries.glossariesFeature;
  features.appUpdateFeature = glossaries.appUpdateFeature;

  const status = createStatusDomain({
    features,
    documentRef,
    bridge,
    setText: bridge.setText,
    statusDetailHolder,
  });

  const library = createLibraryDomain({ features, documentRef, statusArea });

  const { appActionsFeature } = createAppActions({
    features,
    bridge,
    setText: bridge.setText,
    workflowView,
    uploadView,
    uploadStatePort,
    legacyState,
    jobRuntimeState: status.jobRuntimeState,
    statusCardPresenter: status.statusCardPresenter,
    libraryEventPort: library.libraryEventPort,
    settingsHubDialogStore: credentials.settingsHubDialogStore,
  });
  features.appActionsFeature = appActionsFeature;

  // Must register the closeTranslationWorkflow listener before recent-jobs:
  // recent-jobs scheduleRefresh sync-reads isWorkflowOpen (DOM data-open);
  // if workflow close() has not yet written data-open to 0, the refresh is swallowed by isSuspended (blueprint risk 5).
  const disposeWorkflowDialogEvents = workflowDialog.bindEvents();

  // job-runtime / recent-jobs / artifacts: mount all at once
  Object.assign(features, createRuntimeFeatures({
    features,
    bridge,
    jobRuntimeState: status.jobRuntimeState,
    statusCardPresenter: status.statusCardPresenter,
    uploadStatePort,
    libraryEventPort: library.libraryEventPort,
    jobRuntimeShellViewPort: status.jobRuntimeShellViewPort,
    artifactDownloadsViewPort: status.artifactDownloadsViewPort,
    recentJobsStatePort: library.recentJobsStatePort,
    recentJobsViewPort: library.recentJobsViewPort,
    recentJobsJobRuntimePort: library.recentJobsJobRuntimePort,
    recentJobsReaderPort: library.recentJobsReaderPort,
    recentJobsNavigationPort: library.recentJobsNavigationPort,
    documentLibraryResource: library.documentLibraryResource,
    homeStatePort,
  }));

  const lifecycle = createLifecycle({
    features,
    bridge,
    documentRef,
    disposeWorkflowDialogEvents,
  });
  features.appShellFeature = lifecycle.appShellFeature;

  return buildHomeServices({
    bridge,
    features,
    initialize: lifecycle.initialize,
    dispose: lifecycle.dispose,
    ports: {
      credentialsStatePort,
      dialogStatePort,
      homeStatePort,
      uploadStatePort,
    },
    views: {
      textStore,
      uploadView,
      workflowView,
      statusArea,
      workflowDialog,
    },
    domains: {
      credentials,
      glossaries,
      appUpdate: glossaries,
      status,
      library,
    },
  });
}




