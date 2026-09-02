// Pure view state for AppUpdateBanner + store-driven viewPort wired to features/app-update/controller.js (kept).
// Mirrors credentials-view-store.js / glossaries-store.js (Blueprint §5).
//
// Legacy update-view-port.js/view.js were DOM direct-write (dead, not imported); here we re-implement
// with the same method signatures (bindButton/setChecking/setReady/setAvailable/setLatest/setError),
// only changing the write destination from DOM to store. Field behavior copied from
// src/js/features/app-update/view.js:88-166 (setUpdateChecking/setUpdateReady/setUpdateAvailable/
// setUpdateLatest/setUpdateError); controller.js (checkForUpdates orchestration + 24h cache) reused verbatim.

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

/** Release info payload for setAvailable / setLatest */
export type AppUpdateReleaseInfo = {
  latestVersion?: string;
  currentVersion?: string;
  title?: string;
  body?: string;
  htmlUrl?: string;
};

function panelOf({
  title = "Check updates",
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
      buttonTitle: "Check for updates",
      statusText: "",
      panel: panelOf({
        title: "Check for updates",
        body: "Click \"Recheck\" to get the latest version from GitHub Releases.",
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
      statusText: "Checking GitHub Releases...",
      panel: panelOf({
        title: "Checking for updates",
        body: "Connecting to GitHub Releases...",
      }),
    }),
    // Copied from view.js:102-115 (setUpdateReady)
    setReady: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.idle,
      hasUpdate: false,
      buttonTitle: "Check for updates",
      statusText: "",
      panel: panelOf({
        title: "Check for updates",
        body: "Click \"Recheck\" to get the latest version from GitHub Releases.",
      }),
    }),
    // Copied from view.js:117-133 (setUpdateAvailable)
    setAvailable: (info: AppUpdateReleaseInfo = {}) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.available,
      hasUpdate: true,
      buttonTitle: `New version found: ${info.latestVersion}`,
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
      buttonTitle: "Already on latest version",
      statusText: "Already on latest version",
      panel: panelOf({
        title: "Already on latest version",
        body: "Current version is already the latest on GitHub Releases.",
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
        body: error?.message || "Unable to connect to GitHub Releases.",
      }),
    }),
  };

  return {
    store,
    viewPort,
    handlersRef,
  };
}
