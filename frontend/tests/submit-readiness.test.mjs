import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSubmitReadiness,
  SUBMIT_BLOCK_REASONS,
} from "../src/js/contracts/submit-readiness-contract.js";
import { resolveSubmitControlState } from "../src/js/features/workflow/submit-controls.js";

const workflowNeedsUpload = (workflow) => workflow !== "render";
const workflowNeedsCredentials = (workflow) => workflow !== "render";
const workflowSubmitLabel = (workflow) => workflow === "render" ? "开始渲染" : "直接翻译";

test("resolveSubmitReadiness allows mock submissions without source or credentials", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    isMock: true,
    needsUpload: true,
    needsCredentials: true,
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.NONE);
});

test("resolveSubmitReadiness reports missing browser credentials before source checks", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    desktopMode: false,
    hasBrowserCredentials: false,
    needsUpload: true,
    needsCredentials: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.credentialsMissing, true);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS);
});

test("resolveSubmitReadiness reports missing upload for upload workflows", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    desktopMode: false,
    hasBrowserCredentials: true,
    needsUpload: true,
    needsCredentials: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_UPLOAD);
});

test("resolveSubmitReadiness reports missing render source for render workflows", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "render",
    needsUpload: false,
    needsCredentials: false,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE);
});

test("resolveSubmitReadiness reports budget blocking after source is ready", () => {
  const readiness = resolveSubmitReadiness({
    workflow: "book",
    uploadId: "upload-1",
    hasBrowserCredentials: true,
    needsUpload: true,
    needsCredentials: true,
    budgetBlocking: true,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING);
});

test("resolveSubmitControlState consumes shared submit readiness", () => {
  const state = resolveSubmitControlState({
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "upload-1",
    renderSourceJobId: "",
    hasBrowserCredentials: true,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, false);
  assert.equal(state.actionVisible, true);
  assert.equal(state.pageRangeVisible, true);
  assert.equal(state.label, "直接翻译");
  assert.equal(state.readiness.ready, true);
});

test("resolveSubmitControlState disables submit when budget blocks", () => {
  const state = resolveSubmitControlState({
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "upload-1",
    renderSourceJobId: "",
    hasBrowserCredentials: true,
    budgetBlocking: true,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.actionVisible, true);
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING);
});

test("resolveSubmitControlState preserves render source disabled behavior", () => {
  const state = resolveSubmitControlState({
    workflow: "render",
    isMock: false,
    desktopMode: false,
    uploadId: "",
    renderSourceJobId: "",
    hasBrowserCredentials: false,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.actionVisible, true);
  assert.equal(state.pageRangeVisible, false);
  assert.equal(state.label, "开始渲染");
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE);
});
