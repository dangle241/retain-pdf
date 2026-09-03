import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_BODY_FONT_SIZE_FACTOR,
  DEFAULT_BODY_LEADING_FACTOR,
  DEFAULT_CLASSIFY_BATCH_SIZE,
  DEFAULT_COMPILE_WORKERS,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
  DEFAULT_INNER_BBOX_SHRINK_X,
  DEFAULT_INNER_BBOX_SHRINK_Y,
  DEFAULT_LANGUAGE,
  DEFAULT_MODE,
  DEFAULT_PDF_COMPRESS_DPI,
  DEFAULT_RENDER_MODE,
  DEFAULT_RULE_PROFILE,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_TRANSLATED_PDF_NAME,
  DEFAULT_TYPST_FONT_FAMILY,
  DEFAULT_WORKERS,
  DEFAULT_MODEL_VERSION,
} from "../../composition/external.js";

// Workflow constants and normalization.
//
// Copied from bootstrap/workflow-constants.js and bootstrap/workflow-normalizers.js:
// bootstrap/ belongs to the old DI assembly layer, architecture-boundaries gate
// forbids pages from importing it;
// the constants body still comes from src/js/config/ (pure logic), the copy is only
// the assembly boilerplate.
// When home cutover deletes the old world, the bootstrap version retires with it,
// and this file becomes the single source of truth.

export const WORKFLOW_BOOK = "book";
export const WORKFLOW_TRANSLATE = "translate";
export const WORKFLOW_RENDER = "render";

export function workflowConstants() {
  return {
    DEFAULT_WORKERS,
    DEFAULT_BATCH_SIZE,
    DEFAULT_CLASSIFY_BATCH_SIZE,
    DEFAULT_COMPILE_WORKERS,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_MODEL_VERSION,
    DEFAULT_LANGUAGE,
    DEFAULT_MODE,
    DEFAULT_RULE_PROFILE,
    DEFAULT_RENDER_MODE,
    DEFAULT_TYPST_FONT_FAMILY,
    DEFAULT_PDF_COMPRESS_DPI,
    DEFAULT_TRANSLATED_PDF_NAME,
    DEFAULT_BODY_FONT_SIZE_FACTOR,
    DEFAULT_BODY_LEADING_FACTOR,
    DEFAULT_INNER_BBOX_SHRINK_X,
    DEFAULT_INNER_BBOX_SHRINK_Y,
    DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
    DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
    WORKFLOW_BOOK,
    WORKFLOW_TRANSLATE,
    WORKFLOW_RENDER,
  };
}

export function normalizeWorkflow(value, {
  book = WORKFLOW_BOOK,
  translate = WORKFLOW_TRANSLATE,
  render = WORKFLOW_RENDER,
} = {}) {
  const workflow = `${value || ""}`.trim();
  if (workflow === translate || workflow === render) {
    return workflow;
  }
  return book;
}

export function normalizeMathMode(value) {
  return `${value || ""}`.trim() === "placeholder" ? "placeholder" : "direct_typst";
}

