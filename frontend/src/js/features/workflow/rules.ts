export function positiveInteger(value, fallback) {
  const fallbackNumber = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
    ? Math.floor(fallbackNumber)
    : 1;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return normalizedFallback;
  }
  return Math.floor(number);
}

export function buildDeveloperConfigWithDefaults({
  saved,
  normalizeWorkflow,
  normalizeMathMode,
  defaults,
  defaultModelName,
  defaultModelBaseUrl,
}: any) {
  const source = saved || {};
  return {
    workflow: normalizeWorkflow(source.workflow),
    renderSourceJobId: `${source.renderSourceJobId || ""}`.trim(),
    mathMode: normalizeMathMode(source.mathMode),
    model: source.model || defaultModelName(),
    baseUrl: source.baseUrl || defaultModelBaseUrl(),
    glossaryId: `${source.glossaryId || source.glossary_id || ""}`.trim(),
    workers: positiveInteger(source.workers, defaults.workers),
    batchSize: positiveInteger(source.batchSize, defaults.batchSize),
    classifyBatchSize: positiveInteger(source.classifyBatchSize, defaults.classifyBatchSize),
    compileWorkers: positiveInteger(source.compileWorkers, defaults.compileWorkers),
    timeoutSeconds: positiveInteger(source.timeoutSeconds, defaults.timeoutSeconds),
    translateTitles: source.translateTitles !== false,
  };
}

export function workflowNeedsUpload(workflow, constants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowNeedsCredentials(workflow, constants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowUsesRenderStage(workflow, constants) {
  return workflow === constants.WORKFLOW_BOOK || workflow === constants.WORKFLOW_RENDER;
}

export function workflowSubmitLabel(workflow, constants) {
  // UI 文案: Upload弹窗主按钮"Translate directly"；render 仍用"Start rendering"
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "Start rendering";
    case constants.WORKFLOW_TRANSLATE:
      return "Translate directly";
    case constants.WORKFLOW_BOOK:
      return "Translate directly";
    default:
      return "Translate directly";
  }
}

export function workflowHeadline(workflow, constants) {
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "The current workflow reuses existing job artifacts to regenerate the PDF.";
    default:
      return "Select PDF 后, 可Translate directly或仅Favorite到书架.";
  }
}




