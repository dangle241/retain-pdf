import test from "node:test";
import assert from "node:assert/strict";

import {
  progressTextForStageProgress,
  summarizeStageProgressText,
} from "../src/js/job-status/job-status-summary-progress.js";
import { buildJobStatusSummaryViewModel } from "../src/js/job-status/job-status-summary-view-model.js";

test("summarizeStageProgressText formats stable user-facing progress copy", () => {
  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "translation",
      substage: "translation_batches",
      progress: {
        unit: "batch",
        current: 2,
        total: 5,
      },
    }),
"Batch 2/5",
  );

  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_compile",
      progress: {
        unit: "step",
        current: 1,
        total: 2,
      },
    }),
"Compiling PDF",
  );

  assert.equal(
    summarizeStageProgressText({
      status: "running",
      display_stage: "render",
      stage: "rendering",
      substage: "render_prewarm",
      progress: {
        unit: "step",
        current: 1,
        total: 4,
      },
    }),
"Prewarm 1/4",
  );
});

test("progressTextForStageProgress formats record progress without legacy payload", () => {
  assert.equal(
    progressTextForStageProgress({
      stageKey: "translate",
      substageKey: "translation_batches",
      progress: {
        current: 2,
        total: 5,
        unit: "batch",
      },
    }),
"Batch 2/5",
  );

  assert.equal(
    progressTextForStageProgress({
      stageKey: "render",
      substageKey: "render_compile",
      progress: {
        current: 1,
        total: 2,
        unit: "step",
      },
    }),
"Compiling PDF",
  );

  assert.equal(
    progressTextForStageProgress({
      stageKey: "render",
      substageKey: "render_prewarm",
      progress: {
        current: 1,
        total: 4,
        unit: "step",
      },
    }),
"Prewarm 1/4",
  );
});

test("job status summary view model owns summary fields without DOM writes", () => {
  const viewModel = buildJobStatusSummaryViewModel({
    job_id: "job-summary-vm",
    status: "failed",
    failure: {
summary: "Translation failed",
    },
  }, {
detail: "Translating main content",
  });

  assert.deepEqual(viewModel.fields, {
    jobId: "job-summary-vm",
    jobIdInput: "job-summary-vm",
stageDetail: "Translating main content",
statusSummary: "Task failed, please check the error message and retry.",
    finishedAt: "-",
    queryFinishedAt: "-",
  });
assert.equal(viewModel.publicErrorText, "Translation failed");
assert.equal(viewModel.errorText, "Translation failed");
});
