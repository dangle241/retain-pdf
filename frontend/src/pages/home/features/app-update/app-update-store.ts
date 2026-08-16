// Trạng thái view thuần của AppUpdateBanner + viewPort dựa trên store nối với features/app-update/controller.js được giữ
// (bản thiết kế §5, phản chiếu cách viết của
// credentials-view-store.js/glossaries-store.js).
//
// update-view-port.js/view.js cũ đều ghi DOM trực tiếp (không dùng, không import); tại đây triển khai lại
// các chữ ký cùng tên (bindButton/setChecking/setReady/setAvailable/setLatest/
// setError), chỉ đổi đích "ghi" từ DOM sang store. Hành vi từng trường sao chép từ code cũ để
// src/js/features/app-update/view.js:88-166(setUpdateChecking/setUpdateReady/
// setUpdateAvailable/setUpdateLatest/setUpdateError),controller.js
// tái sử dụng nguyên dòng điều phối checkForUpdates + cache 24 giờ.

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

/** Payload thông tin phát hành của setAvailable / setLatest. */
export type AppUpdateReleaseInfo = {
  latestVersion?: string;
  currentVersion?: string;
  title?: string;
  body?: string;
  htmlUrl?: string;
};

function panelOf({
  title = "Kiểm tra cập nhật",
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
      buttonTitle: "Kiểm tra cập nhật",
      statusText: "",
      panel: panelOf({
        title: "Kiểm tra cập nhật",
        body: "Bấm “Kiểm tra lại” để lấy phiên bản mới nhất từ GitHub Releases.",
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
    // Sao chép từ view.js:88-100 (setUpdateChecking).
    setChecking: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.checking,
      hasUpdate: store.getSnapshot().hasUpdate,
      buttonTitle: "Đang kiểm tra cập nhật",
      statusText: "Đang kiểm tra GitHub Releases...",
      panel: panelOf({
        title: "Đang kiểm tra cập nhật",
        body: "Đang kết nối GitHub Releases...",
      }),
    }),
    // Sao chép từ view.js:102-115 (setUpdateReady).
    setReady: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.idle,
      hasUpdate: false,
      buttonTitle: "Kiểm tra cập nhật",
      statusText: "",
      panel: panelOf({
        title: "Kiểm tra cập nhật",
        body: "Bấm “Kiểm tra lại” để lấy phiên bản mới nhất từ GitHub Releases.",
      }),
    }),
    // Sao chép từ view.js:117-133 (setUpdateAvailable).
    setAvailable: (info: AppUpdateReleaseInfo = {}) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.available,
      hasUpdate: true,
      buttonTitle: `Đã tìm thấy phiên bản mới ${info.latestVersion}`,
      statusText: "Đã tìm thấy phiên bản mới",
      panel: panelOf({
        title: info.title || `RetainPDF ${info.latestVersion}`,
        body: info.body,
        latestVersion: info.latestVersion,
        currentVersion: info.currentVersion,
        htmlUrl: info.htmlUrl,
      }),
    }),
    // Sao chép từ view.js:135-151 (setUpdateLatest).
    setLatest: (info?: AppUpdateReleaseInfo | null) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.latest,
      hasUpdate: false,
      buttonTitle: "Đang dùng phiên bản mới nhất",
      statusText: "Đang dùng phiên bản mới nhất",
      panel: panelOf({
        title: "Đang dùng phiên bản mới nhất",
        body: "Phiên bản hiện tại đã là phiên bản mới nhất trên GitHub Releases.",
        latestVersion: info?.latestVersion || APP_VERSION,
        currentVersion: info?.currentVersion || APP_VERSION,
        htmlUrl: info?.htmlUrl || "",
      }),
    }),
    // Sao chép từ view.js:153-166 (setUpdateError).
    setError: (error?: { message?: string } | null) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.error,
      hasUpdate: false,
      buttonTitle: "Kiểm tra cập nhật thất bại",
      statusText: "Kiểm tra thất bại",
      panel: panelOf({
        title: "Kiểm tra cập nhật thất bại",
        body: error?.message || "Tạm thời không thể kết nối GitHub Releases.",
      }),
    }),
  };

  return {
    store,
    viewPort,
    handlersRef,
  };
}
