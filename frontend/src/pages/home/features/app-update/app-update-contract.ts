// AppUpdateBanner id/status contract (blueprint §5 + §0.1).
//
// Copied from src/js/components/layout/app-update-dom-contract.js (old custom element
// view layer; architecture-boundaries guard prohibits src/pages/** from directly
// importing js/components/**) — same technique already used once at 3a Stage in
// src/pages/home/features/app-shell/app-update-contract.js (at that time only
// required IDS; detail dialog skeleton temporarily hung on AppShellHeader.jsx). This
// file fills in STATES/CLASSES, the sole source for 3b app-update domain (button +
// detail dialog merged into AppUpdateBanner.jsx); the 3a partial copy was removed
// along with AppShellHeader's old template cleanup, leaving no two duplicate contracts.

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



