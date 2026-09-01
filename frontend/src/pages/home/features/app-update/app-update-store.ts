// AppUpdateBanner pure view state + integrated store driving viewPort via features/app-update/controller.js (kept
// controller) (Blueprint Â§5, mirroring
// credentials-view-store.js/glossaries-store.js Syntax)。
//
// Old World update-view-port.js/view.js were direct DOM writes (dead, do not import); here use
// Same-name method signature(bindButton/setChecking/setReady/setAvailable/setLatest/
// setError) Reimplement. Only the "write" destination changed from DOM to store; field-wise behavior copied from
// src/js/features/app-update/view.js:88-166(setUpdateChecking/setUpdateReady/
// setUpdateAvailable/setUpdateLatest/setUpdateError),controller.js
// (checkForUpdates Orchestration + 24h cache) Reuse unchanged.

import { APP_UPDATE_STATES } from "./app-update-contract.js";
import type { HandlersBag } from "../../composition/types.js";
import {
  createStore,
  APP_VERSION,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

export type AppUpdatePanel = {
  title: string;
  body: string;
  latestVersion: string;
  currentVersion: string;
  htmlUrl: string;
};

export type AppUpdateViewState = {
  buttonState: string;
  hasUpdate: boolean;
  buttonTitle: string;
  statusText: string;
  panel: AppUpdatePanel;
};

export type AppUpdateViewActions = {
  apply(
    _currentState: AppUpdateViewState,
    nextState: AppUpdateViewState,
  ): AppUpdateViewState;
};

export type AppUpdateViewStore = Store<AppUpdateViewState, AppUpdateViewActions>;

/** setAvailable / setLatest Publish payload */
export type AppUpdateReleaseInfo = {
  latestVersion?: string;
  currentVersion?: string;
  title?: string;
  body?: string;
  htmlUrl?: string;
};

function panelOf({
title = "Check for Updates",
  body = "",
  latestVersion = "",
  currentVersion = APP_VERSION,
  htmlUrl = "",
}: Partial<AppUpdatePanel> = {}): AppUpdatePanel {
  return { title, body, latestVersion, currentVersion, htmlUrl };
}

export function createAppUpdateViewFeature() {
  const store = createStore<AppUpdateViewState, AppUpdateViewActions>({
    name: "appUpdateView",
    initialState: {
      buttonState: APP_UPDATE_STATES.idle,
      hasUpdate: false,
buttonTitle: "Check for Updates",
      statusText: "",
      panel: panelOf({
title: "Check for Updates",
        body: "Click "Recheck" from GitHub Releases Get latest version.",
      }),
    },
    actions: {
      apply(_currentState, nextState) {
        return nextState;
      },
    },
  });

  const handlersRef: { current: HandlersBag | null } = { current: null };

  const viewPort = {
    bindButton: (handlers: HandlersBag) => {
      handlersRef.current = handlers;
    },
// Copied from view.js:88-100 (setUpdateChecking)
    setChecking: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.checking,
      hasUpdate: store.getSnapshot().hasUpdate,
      buttonTitle: "Checking for updates",
      statusText: "Checking... GitHub Releases...",
      panel: panelOf({
title: "Checking for Updates",
        body: "Connecting GitHub Releases...",
      }),
    }),
// Copied from view.js:102-115 (setUpdateReady)
    setReady: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.idle,
      hasUpdate: false,
buttonTitle: "Check for Updates",
      statusText: "",
      panel: panelOf({
title: "Check for Updates",
body: "Click 'Recheck' to get the latest version from GitHub Releases.",
      }),
    }),
// Copied from view.js:117-133 (setUpdateAvailable)
    setAvailable: (info: AppUpdateReleaseInfo = {}) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.available,
      hasUpdate: true,
      buttonTitle: `New version available ${info.latestVersion}`,
statusText: "New version found",
      panel: panelOf({
        title: info.title || `RetainPDF ${info.latestVersion}`,
        body: info.body,
        latestVersion: info.latestVersion,
        currentVersion: info.currentVersion,
        htmlUrl: info.htmlUrl,
      }),
    }),
// Copied from view.js:135-151 (setUpdateLatest)
    setLatest: (info?: AppUpdateReleaseInfo | null) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.latest,
      hasUpdate: false,
      buttonTitle: "Up to date",
statusText: "Already up to date",
      panel: panelOf({
title: "Already up to date",
        body: "Already current version GitHub Releases Latest version installed.",
        latestVersion: info?.latestVersion || APP_VERSION,
        currentVersion: info?.currentVersion || APP_VERSION,
        htmlUrl: info?.htmlUrl || "",
      }),
    }),
// Copied from view.js:153-166 (setUpdateError)
    setError: (error?: { message?: string } | null) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.error,
      hasUpdate: false,
buttonTitle: "Update check failed",
      statusText: "Check failed",
      panel: panelOf({
title: "Update check failed",
        body: error?.message || "Temporarily unable to connect. GitHub Releases。",
      }),
    }),
  };

  return {
    store,
    viewPort,
    handlersRef,
  };
}
