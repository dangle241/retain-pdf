// AppUpdateBanner 的 id/状态契约(蓝图 §5 + §0.1)。
//
// 拷贝自 src/js/components/layout/app-update-dom-contract.js(旧自定义元素
// 视图层,architecture-boundaries 门禁禁止 src/pages/** 直接 import
// js/components/**)——同一手法 3a 阶段已在
// src/pages/home/features/app-shell/app-update-contract.js 用过一次(当时只
// 需要 IDS,详情 dialog 骨架临时挂在 AppShellHeader.jsx)。本文件补齐
// STATES/CLASSES,是 3b app-update 域(按钮 + 详情 dialog 合并进
// AppUpdateBanner.jsx)唯一出处;3a 那份局部拷贝随 AppShellHeader 清理旧
// 模板一并移除,不留两份重复契约。

export const APP_UPDATE_IDS = Object.freeze({
  button: "app-update-btn",
  dialog: "app-update-dialog",
  status: "app-update-status",
  checkButton: "app-update-check-btn",
});

export const APP_UPDATE_STATES = Object.freeze({
  checking: "checking",
  idle: "idle",
  available: "available",
  latest: "latest",
  error: "error",
});

export const APP_UPDATE_CLASSES = Object.freeze({
  hidden: "hidden",
  hasUpdate: "has-update",
});
