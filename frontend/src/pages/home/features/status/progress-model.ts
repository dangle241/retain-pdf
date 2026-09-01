// Risk 6 (first frame placeholder): jobRuntimeFeature.startPolling() in the synchronous chain of
// renderJob() will be awaited before the network request, first write once placeholder snapshot
// js/components/ Anti-rebound access control restricted zone,Only pure functions can be copied,Cannot import)。
// Keep verbatim,No behavior rewrite;ProgressBlock.jsx / useStagedProgressAnimation.js
// Share this file.

// (render-context.js's applyJobRuntimeSnapshot sync writes currentJobStore),
export type ProgressRenderModelInput = {
  current?: number;
  total?: number;
  fallbackText?: string;
  displayPercent?: number | null;
  percent?: number;
  progressText?: string;
  progressUnit?: string;
  stageKey?: string;
  status?: string;
  forceVisible?: boolean | null;
  indeterminate?: boolean;
};

export type ProgressRenderModel = {
  visible: boolean;
  percent: number;
  text: string;
  componentText: string;
  indeterminate: boolean;
  legacyIndeterminate: boolean;
};

function progressRenderPercent(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }
  const numericValue = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(numericValue) ? numericValue : 0));
}

function capRunningRenderPercent(percent: number, stageKey = "", status = ""): number {
  const normalizedStageKey = `${stageKey || ""}`.trim();
  const normalizedStatus = `${status || ""}`.trim();
  if (
    normalizedStatus === "running"
    && ["ocr", "translate", "render"].includes(normalizedStageKey)
    && Number(percent) >= 100
  ) {
    return 99;
  }
  return percent;
}

export function buildProgressRenderModel({
  current = NaN,
  total = NaN,
  fallbackText = "-",
  displayPercent = null,
  percent = NaN,
  progressText = "",
  progressUnit = "",
  stageKey = "",
  status = "",
  forceVisible = null,
  indeterminate = false,
}: ProgressRenderModelInput = {}): ProgressRenderModel {
  const normalizedStageKey = `${stageKey || ""}`.trim();
  const visible = forceVisible ?? ["ocr", "translate", "render"].includes(normalizedStageKey);
  if (!visible) {
    return {
      visible: false,
      percent: 0,
      text: "",
      componentText: "-",
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  const numericCurrent = Number(current);
  const numericTotal = Number(total);
  const numericDisplayPercent = progressRenderPercent(displayPercent);
  const numericPercent = Number(percent);
  const normalizedProgressUnit = `${progressUnit || ""}`.trim();
  const textFallback = progressText || fallbackText;

  if (indeterminate) {
    return {
      visible: true,
      percent: 42,
      text: textFallback,
      componentText: textFallback,
      indeterminate: true,
      legacyIndeterminate: true,
    };
  }

  if (Number.isFinite(numericDisplayPercent)) {
    const safePercent = capRunningRenderPercent(numericDisplayPercent, normalizedStageKey, status);
    const text = progressText || `进度 ${safePercent.toFixed(0)}%`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  const hasNumbers = Number.isFinite(numericCurrent) && Number.isFinite(numericTotal) && numericTotal > 0;
  if (hasNumbers && normalizedProgressUnit === "percent") {
    const safePercent = capRunningRenderPercent(
      progressRenderPercent((numericCurrent / numericTotal) * 100),
      normalizedStageKey,
      status,
    );
    const text = progressText || `进度 ${safePercent.toFixed(0)}%`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  if (hasNumbers) {
    const safePercent = capRunningRenderPercent(
      progressRenderPercent((numericCurrent / numericTotal) * 100),
      normalizedStageKey,
      status,
    );
    const text = progressText || `${numericCurrent} / ${numericTotal} (${safePercent.toFixed(0)}%)`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }

  if (Number.isFinite(numericPercent)) {
    const safePercent = capRunningRenderPercent(
      progressRenderPercent(numericPercent),
      normalizedStageKey,
      status,
    );
    const text = progressText || `进度 ${safePercent.toFixed(0)}%`;
    return {
      visible: true,
      percent: safePercent,
      text,
      componentText: text,
      indeterminate: false,
      legacyIndeterminate: false,
    };
  }
  const text = progressText || fallbackText;
  return {
    visible: true,
    percent: 0,
    text,
    componentText: text,
    indeterminate: false,
    legacyIndeterminate: false,
  };
}
