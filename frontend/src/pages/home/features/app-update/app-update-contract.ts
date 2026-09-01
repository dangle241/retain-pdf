// AppUpdateBanner ID/State contract (Blueprint Â§5 + Â§0.1).
//
// Copied from src/js/components/layout/app-update-dom-contract.js(Legacy custom element
// View layer, architecture-boundaries gate prohibits src/pages/** from directly importing
// js/components/**)——Same approach 3a Stage already in
// src/pages/home/features/app-shell/app-update-contract.js Used once(Only then
// Needs IDs, details dialog skeleton temporarily mounted on AppShellHeader.jsx). This file supplements
// STATES/CLASSES, part of 3b app-update domain (Button + details dialog merge into
// AppUpdateBanner.jsx)Single source of truth;3a That local copy follows AppShellHeader Clean old
// Remove template too.,Avoid duplicate contracts.

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
