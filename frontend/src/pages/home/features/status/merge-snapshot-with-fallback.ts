// statusCard 快照 + 书架 live item 合并.
//
// Question: attachJobProgress → startPolling 首帧会推 placeholder
// (status=queued, stage_detail=Loading...), Complete书会被盖成queued.
// books函数把书架 item 的终态/Progress补回 snapshot, 详情与主Workflowtotal用一处.

import type { StatusCardJobRecord, StatusCardSnapshot } from "./status-card-store.js";

/** 书架 live 行(library item)上与Progress合并相关的字段 */
export type StatusCardFallbackItem = {
  job_id?: string;
  status?: string;
  stage_detail?: string;
  detail?: string;
  output_pdf_ready?: boolean;
  created_at?: string;
  updated_at?: string;
  progress?: {
    percent?: number;
    current?: number;
    total?: number;
    unit?: string;
  } | null;
  [key: string]: unknown;
};

/**
 * @param snapshot statusCardStore.snapshot
 * @param fallbackItem 书架 item
 */
export function mergeSnapshotWithFallback(
  snapshot: StatusCardSnapshot | null | undefined,
  fallbackItem: StatusCardFallbackItem | null = null,
): StatusCardSnapshot | null | undefined {
  if (!fallbackItem || typeof fallbackItem !== "object") {
    return snapshot;
  }
  const snapJob = `${snapshot?.jobId || ""}`.trim();
  const itemJob = `${fallbackItem.job_id || ""}`.trim().replace(/^doc:/, "");
  if (!itemJob) {
    return snapshot;
  }
  if (snapJob && snapJob !== itemJob && !snapJob.startsWith("doc:")) {
    const snapStatus = `${snapshot?.status || ""}`.trim();
    if (snapStatus && snapStatus !== "queued") {
      return snapshot;
    }
  }

  const itemStatus = `${fallbackItem.status || ""}`.trim().toLowerCase();
  const snapStatus = `${snapshot?.status || ""}`.trim().toLowerCase();
  const snapIsWeak =
    !snapStatus
    || snapStatus === "queued"
    || !snapJob
    || `${snapshot?.detail || ""}`.includes("Loading")
    || `${snapshot?.value || ""}`.includes("Preparing");

  const progress = fallbackItem.progress && typeof fallbackItem.progress === "object"
    ? fallbackItem.progress
    : {};
  const itemPercent = Number(progress.percent);
  const itemCurrent = Number(progress.current);
  const itemTotal = Number(progress.total);

  if (itemStatus === "succeeded" && (snapIsWeak || snapStatus !== "succeeded")) {
    const snapJobRecord = snapshot?.job as StatusCardJobRecord | null | undefined;
    const jobMatches = snapJobRecord
      && `${snapJobRecord.job_id || snapshot?.jobId || ""}`.trim() === itemJob;
    const succeededJob: StatusCardJobRecord = jobMatches && snapJobRecord
      ? snapJobRecord
      : {
          job_id: itemJob,
          status: "succeeded",
          stage: "finished",
          stage_detail: (fallbackItem.stage_detail as string) || "任务Done",
          progress: {
            percent: 100,
            current: itemCurrent || 100,
            total: itemTotal || 100,
            unit: "percent",
          },
          timestamps: {
            started_at: (fallbackItem.created_at as string) || "",
            finished_at: (fallbackItem.updated_at as string) || "",
          },
        };
    return {
      ...snapshot!,
      jobId: itemJob,
      status: "succeeded",
      stageKey: "done",
      label: "Done",
      value: "Translation PDF has been generated",
      detail: `${fallbackItem.stage_detail || "任务Done"}`.trim(),
      displayPercent: 100,
      progressPercent: 100,
      progressCurrent: Number.isFinite(itemCurrent) ? itemCurrent : 100,
      progressTotal: Number.isFinite(itemTotal) && itemTotal > 0 ? itemTotal : 100,
      progressFallbackText: "Done",
      progressText: "Rendering complete",
      progressUnit: "percent",
      progressIndeterminate: false,
      visualStageKey: "done",
      cancelEnabled: false,
      readerReady: true,
      pdfReady: Boolean(fallbackItem.output_pdf_ready ?? true),
      job: succeededJob,
    };
  }

  if (itemStatus === "failed" && snapIsWeak) {
    return {
      ...snapshot!,
      jobId: itemJob,
      status: "failed",
      label: "Failed",
      value: "任务Failed",
      detail: `${fallbackItem.stage_detail || ""}`.trim(),
      cancelEnabled: false,
    };
  }

  if ((itemStatus === "running" || itemStatus === "queued") && snapIsWeak) {
    return {
      ...snapshot!,
      jobId: itemJob,
      status: itemStatus,
      stageKey: snapshot?.stageKey || "ocr",
      label: snapshot?.label || (itemStatus === "queued" ? "Queued" : "Processing"),
      detail: `${fallbackItem.stage_detail || snapshot?.detail || ""}`.trim(),
      displayPercent: Number.isFinite(itemPercent) ? itemPercent : snapshot?.displayPercent ?? null,
      progressPercent: Number.isFinite(itemPercent) ? itemPercent : (snapshot?.progressPercent ?? NaN),
      progressCurrent: Number.isFinite(itemCurrent) ? itemCurrent : (snapshot?.progressCurrent ?? NaN),
      progressTotal: Number.isFinite(itemTotal) ? itemTotal : (snapshot?.progressTotal ?? NaN),
    };
  }

  return snapshot;
}

/** 书架 live 行yesno为 startPolling 首帧占位(Dialog 层与 snapshot 层total用) */
export function isPollingBootstrapPlaceholder(item: StatusCardFallbackItem = {}): boolean {
  const status = `${item.status || ""}`.trim();
  const detail = `${item.stage_detail || item.detail || ""}`;
  return status === "queued" && detail.includes("Loading任务Status");
}




