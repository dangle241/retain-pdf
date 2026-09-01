#!/usr/bin/env node

import {
  collectStageProgressByKey,
  resolveDisplayedStagePresentation,
} from "../src/js/job-status/job-stage-presentation.js";
import { resolveVisualStageKeyForSnapshot } from "../src/js/components/status/job-status-card-visuals.js";

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}


function checkOcrPresentationUsesPageProgress() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
stage_detail: "Executing OCR, page 5/12",
    progress_current: 5,
    progress_total: 12,
  };
  const events = {
    items: [
      {
        stage: "queued",
        event_type: "stage_progress",
        stage_detail: "PDF Upload complete",
        progress_current: 2,
        progress_total: 12,
      },
      {
        stage: "ocr_processing",
        provider_stage: "paddle_running",
        event_type: "stage_progress",
stage_detail: "Executing OCR, page 5/12",
        progress_current: 5,
        progress_total: 12,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "ocr", "OCR stage");
assertEqual(presentation.progressText, "Page 5/12", "OCR progress text");
  assertEqual(presentation.progressCurrent, 5, "OCR progress current");
  assertEqual(presentation.progressTotal, 12, "OCR progress total");
}

function checkOcrPresentationIgnoresFutureStageEvents() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
stage_detail: "Executing OCR",
    progress_current: 5,
    progress_total: 12,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_progress",
stage_detail: "Executing OCR, page 5/12",
        progress_current: 5,
        progress_total: 12,
      },
      {
        stage: "translating",
        event_type: "stage_progress",
stage_detail: "Translating body text, batch 18/55",
        progress_current: 18,
        progress_total: 55,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "ocr", "OCR stage with newer translation event");
assertEqual(presentation.progressText, "Page 5/12", "OCR progress text with newer translation event");
}

function checkOcrPresentationFallsBackToJobProgress() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
stage_detail: "Executing OCR",
    progress_current: 7,
    progress_total: 12,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_transition",
stage_detail: "Executing OCR",
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "ocr", "OCR stage fallback");
assertEqual(presentation.progressText, "Page 7/12", "OCR job progress fallback text");
}

function checkTranslatePresentationUsesBatchProgressWhenDetailMentionsOcr() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
    stage_detail: "OCR Done, begin translating body text.",
    progress_current: 18,
    progress_total: 55,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_progress",
stage_detail: "Executing OCR, page 12/12",
        progress_current: 12,
        progress_total: 12,
      },
      {
        stage: "translating",
        event_type: "stage_progress",
stage_detail: "OCR Done, translating main text, batch 18/55",
        progress_current: 18,
        progress_total: 55,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "translate", "Translate stage with OCR text");
assertEqual(presentation.progressText, "Batch 18/55", "Translate batch progress with OCR text");
}

function checkTranslatePresentationIgnoresOcrEvents() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
stage_detail: "Translating body text",
    progress_current: 18,
    progress_total: 55,
  };
  const events = {
    items: [
      {
        stage: "ocr_processing",
        event_type: "stage_progress",
stage_detail: "Executing OCR, page 12/12",
        progress_current: 12,
        progress_total: 12,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "translate", "Translate stage ignores OCR event");
assertEqual(presentation.progressText, "Batch 18/55", "Translate falls back to job batch progress");
}

function checkContinuationReviewUsesPageProgress() {
  const job = {
    status: "running",
    stage: "continuation_review",
    current_stage: "continuation_review",
stage_detail: "Starting cross-column/page continuation review",
    progress_current: 4,
    progress_total: 12,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "translate", "Continuation review belongs to translate stage");
assertEqual(presentation.label, "Step 2/4 · Cross-column/page judgment", "Continuation review label");
assertEqual(presentation.progressText, "Page 4/12", "Continuation review page progress");
}

function checkPagePoliciesUsePageProgress() {
  const job = {
    status: "running",
    stage: "page_policies",
    current_stage: "page_policies",
stage_detail: "Starting page policies and block classification",
    progress_current: 6,
    progress_total: 12,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "translate", "Page policies belongs to translate stage");
assertEqual(presentation.label, "Step 2/4 · Page policies", "Page policies label");
assertEqual(presentation.progressText, "Page 6/12", "Page policies page progress");
}

function checkTranslateUsesLatestSubstageProgress() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
stage_detail: "OCR done, starting translation",
  };
  const events = {
    items: [
      {
        stage: "translating",
        event_type: "stage_transition",
stage_detail: "Starting pure translation phase",
      },
      {
        stage: "continuation_review",
        event_type: "stage_transition",
stage_detail: "Starting cross-column/page continuation review",
        progress_current: 2,
        progress_total: 10,
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
  assertEqual(presentation.stageKey, "translate", "Translate substage stage");
assertEqual(presentation.label, "Step 2/4 · Cross-column/page judgment", "Translate substage label");
assertEqual(presentation.progressText, "Page 2/10", "Translate substage progress");
  assertEqual(presentation.progressCurrent, 2, "Translate substage current");
  assertEqual(presentation.progressTotal, 10, "Translate substage total");
}

function checkTranslateUsesLatestProgressfulEvent() {
  const job = {
    status: "running",
    stage: "translating",
    current_stage: "translating",
stage_detail: "OCR done, starting translation",
  };
  const events = {
    items: [
      {
        stage: "continuation_review",
        event_type: "stage_transition",
stage_detail: "Starting cross-column/page continuation review",
        progress_current: 0,
        progress_total: 1,
      },
      {
        stage: "continuation_review",
        event_type: "stage_progress",
stage_detail: "Cross-column/page continuation review completed",
        progress_current: 1,
        progress_total: 1,
      },
      {
        stage: "page_policies",
        event_type: "stage_transition",
stage_detail: "Starting page policies and block classification",
        progress_current: 0,
        progress_total: 1,
      },
      {
        stage: "translating",
        event_type: "stage_transition",
stage_detail: "Starting batch translation",
      },
    ],
  };
  const presentation = resolveDisplayedStagePresentation(job, events);
assertEqual(presentation.label, "Step 2/4 · Page policies", "Latest progressful substage label");
assertEqual(presentation.progressText, "Page 0/1", "Latest progressful substage progress");
}

function checkOcrPercentProgressDoesNotLookLikePages() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
    stage_detail: "OCR provider Processing",
    progress_current: 0,
    progress_total: 100,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR percent stage");
assertEqual(presentation.progressText, "OCR processing", "OCR zero percent text");
}

function checkOcrFallbackProgressUsesStageSteps() {
  const job = {
    status: "running",
    stage: "ocr_upload",
    current_stage: "ocr_upload",
stage_detail: "OCR provider transport starting",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR fallback stage");
assertEqual(presentation.progressText, "OCR preparing", "OCR fallback text");
  assertEqual(presentation.progressCurrent, 1, "OCR fallback current");
  assertEqual(presentation.progressTotal, 4, "OCR fallback total");
  assertEqual(presentation.progressIndeterminate, true, "OCR fallback is indeterminate");
}

function checkOcrRealPageProgressIsDeterminate() {
  const job = {
    status: "running",
    stage: "ocr_processing",
    current_stage: "ocr_processing",
stage_detail: "OCR subtask: Paddle is parsing file",
    progress_current: 9,
    progress_total: 24,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
assertEqual(presentation.progressText, "Page 9/24", "OCR real page text");
  assertEqual(presentation.progressIndeterminate, false, "OCR real page is determinate");
}

function checkOcrInternalStagesUseDistinctAnimationKeys() {
  const cases = [
    ["ocr_upload", "ocr_upload"],
    ["ocr_processing", "ocr_processing"],
    ["ocr_result_ready", "ocr_result_ready"],
    ["normalizing", "ocr_normalizing"],
  ];
  for (const [stage, visualStageKey] of cases) {
    const presentation = resolveDisplayedStagePresentation(
      {
        status: "running",
        stage,
        current_stage: stage,
        stage_detail: stage,
      },
      { items: [] },
    );
    assertEqual(presentation.visualStageKey, visualStageKey, `${stage} visual stage`);
  }
}

function checkOcrResultReadyStaysInOcrStage() {
  const job = {
    status: "running",
    stage: "ocr_result_ready",
    current_stage: "ocr_result_ready",
stage_detail: "OCR provider result ready, downloading original bundle",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR result ready stage");
assertEqual(presentation.detail, "OCR provider result ready, downloading original bundle", "OCR result ready detail");
}

function checkOcrUploadWaitingDoesNotLookQueued() {
  const job = {
    status: "running",
    stage: "ocr_upload",
    current_stage: "ocr_upload",
stage_detail: "OCR subtask: Paddle received task, waiting in queue",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "ocr", "OCR upload waiting stage");
  assertEqual(presentation.visualStageKey, "ocr_upload", "OCR upload animation stage");
assertEqual(presentation.label, "Step 1/4 · OCR parsing", "OCR upload waiting label");
assertEqual(presentation.detail, "Paddle received task, waiting in queue", "OCR upload waiting detail");
}

function checkTranslationSubstageOrderDoesNotPreferBatchWhenReviewing() {
  const job = {
    status: "running",
    stage: "continuation_review",
    current_stage: "continuation_review",
stage_detail: "Judging cross-column/page continuation, page 3/9",
    progress_current: 3,
    progress_total: 9,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "translate", "Continuation review remains translate stage");
assertEqual(presentation.label, "Step 2/4 · Cross-column/page judgment", "Continuation review label wins");
assertEqual(presentation.progressText, "Page 3/9", "Continuation review keeps page progress");
}

function checkCompletedStageHasDoneKeyAndNoProgressTextRequirement() {
  const job = {
    status: "succeeded",
    stage: "finished",
    current_stage: "finished",
    stage_detail: "Done. Download results.",
    progress_current: 12,
    progress_total: 12,
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "done", "Completed stage");
assertEqual(presentation.label, "Done", "Completed label");
}

function checkFailedStageUsesFailureSummary() {
  const job = {
    status: "failed",
    stage: "rendering",
    current_stage: "rendering",
stage_detail: "Render stage failed",
    failure: {
summary: "Typst render failed: page 9 text overflow",
    },
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "failed", "Failed stage");
assertEqual(presentation.label, "Failed", "Failed label");
assertEqual(presentation.detail, "Typst render failed: page 9 text overflow", "Failed detail uses failure summary");
}

function checkRunningFinishedStageStaysInRenderUntilTerminal() {
  const job = {
    status: "running",
    stage: "finished",
    current_stage: "finished",
stage_detail: "Task completed",
  };
  const presentation = resolveDisplayedStagePresentation(job, { items: [] });
  assertEqual(presentation.stageKey, "render", "Running finished transition stays render");
assertEqual(presentation.label, "Step 3/4 · Rendering", "Running finished transition label");
}

function checkStartupStageUsesWorkflowContext() {
  const cases = [
["ocr", "ocr", "Step 1/4 · Startup"],
["translate", "translate", "Step 2/4 · Startup"],
["render", "render", "Step 3/4 · Startup"],
  ];
  for (const [workflow, expectedStageKey, expectedLabel] of cases) {
    const presentation = resolveDisplayedStagePresentation(
      {
        status: "running",
        workflow,
        job_type: workflow,
        stage: "startup",
        current_stage: "startup",
stage_detail: ${workflow} worker started,
      },
      { items: [] },
    );
    assertEqual(presentation.stageKey, expectedStageKey, `${workflow} startup stage`);
    assertEqual(presentation.label, expectedLabel, `${workflow} startup label`);
  }
}

function checkRenderPrepareDoesNotLookLikeOcr() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      workflow: "render",
      stage: "render_prepare",
      current_stage: "render_prepare",
stage_detail: "Starting pure render phase",
    },
    { items: [] },
  );
  assertEqual(presentation.stageKey, "render", "Render prepare stage");
assertEqual(presentation.label, "Step 3/4 · Rendering", "Render prepare label");
}

function checkSelectedFutureStageUsesSelectedAnimation() {
  const visualStageKey = resolveVisualStageKeyForSnapshot(
    {
      stageKey: "ocr",
      visualStageKey: "ocr_processing",
    },
    "translate",
  );
  assertEqual(visualStageKey, "translate", "Manual selected stage animation");
}

function checkHistoricalOcrProgressCanBeRecoveredFromEvents() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "succeeded",
      stage: "finished",
      current_stage: "finished",
stage_detail: "Task completed",
    },
    {
      items: [
        {
          stage: "ocr_processing",
          event_type: "stage_progress",
stage_detail: "OCR subtask: Paddle parsing file",
          progress_current: 15,
          progress_total: 22,
        },
        {
          stage: "translating",
          event_type: "stage_progress",
stage_detail: "Translating body text, batch 2/9",
          progress_current: 2,
          progress_total: 9,
        },
      ],
    },
  );
assertEqual(progressByKey.ocr.progressText, "Page 15/22", "Historical OCR progress text");
assertEqual(progressByKey.translate.progressText, "Batch 2/9", "Historical translate progress text");
}

function checkFormalEventContractProgressUnits() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "running",
      stage: "rendering",
      current_stage: "rendering",
stage_detail: "Rendering",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
          substage: "provider_processing",
stage_detail: "Paddle parsing file",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 12,
          progress_total: 34,
        },
        {
          user_stage: "translate",
          stage: "translating",
stage_detail: "Translating",
          event_type: "stage_progress",
          progress_unit: "batch",
          progress_current: 8,
          progress_total: 42,
        },
        {
          user_stage: "render",
          stage: "rendering",
stage_detail: "Rendering",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 18,
          progress_total: 34,
        },
      ],
    },
  );
assertEqual(progressByKey.ocr.progressText, "Page 12/34", "Formal OCR page progress");
assertEqual(progressByKey.translate.progressText, "Batch 8/42", "Formal translate batch progress");
assertEqual(progressByKey.render.progressText, "Page 18/34", "Formal render page progress");
}

function checkOcrZeroPageProgressIsVisibleIndeterminate() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "running",
      stage: "ocr_processing",
      current_stage: "ocr_processing",
stage_detail: "Paddle parsing file, page 0/33",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
          substage: "running",
stage_detail: "Paddle parsing file, page 0/33",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 0,
          progress_total: 33,
        },
      ],
    },
  );
assertEqual(progressByKey.ocr.progressText, "OCR processing, 33 pages total", "OCR zero page progress text");
  assertEqual(progressByKey.ocr.indeterminate, true, "OCR zero page indeterminate progress");
  assertEqual(progressByKey.ocr.visualStageKey, "ocr_processing", "OCR zero page animation stage");
}

function checkPageProgressBeatsLaterStepProgress() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "running",
      stage: "translating",
      current_stage: "translating",
stage_detail: "OCR done, starting translation",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
stage_detail: "Paddle parsing file, page 4/9",
          progress_unit: "page",
          progress_current: 4,
          progress_total: 9,
        },
        {
          user_stage: "ocr",
          stage: "normalizing",
stage_detail: "OCR done, starting normalization",
          progress_unit: "step",
          progress_current: 9,
          progress_total: 9,
        },
      ],
    },
  );
assertEqual(progressByKey.ocr.progressText, "Page 4/9", "OCR page progress beats later step progress");
}

function checkCompletedOcrPageProgressBeatsPartialPageProgress() {
  const progressByKey = collectStageProgressByKey(
    {
      status: "succeeded",
      stage: "finished",
      current_stage: "finished",
stage_detail: "Task completed",
    },
    {
      items: [
        {
          user_stage: "ocr",
          stage: "ocr_processing",
stage_detail: "Paddle parsing file, page 28/33",
          progress_unit: "page",
          progress_current: 28,
          progress_total: 33,
        },
        {
          user_stage: "ocr",
          stage: "ocr_result_ready",
stage_detail: "Paddle parsing file, page 33/33",
          progress_unit: "none",
          progress_current: 33,
          progress_total: 33,
        },
      ],
    },
  );
assertEqual(progressByKey.ocr.progressText, "Page 33/33", "Completed OCR progress beats partial page progress");
}

function checkFormalCurrentEventWinsStageAndUnit() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      stage: "translating",
      current_stage: "translating",
stage_detail: "Translating",
    },
    {
      items: [
        {
          user_stage: "translate",
          stage: "continuation_review",
          substage: "continuation_review",
stage_detail: "Cross-column/page judgment",
          event_type: "stage_progress",
          progress_unit: "page",
          progress_current: 4,
          progress_total: 18,
        },
      ],
    },
  );
  assertEqual(presentation.stageKey, "translate", "Formal translate substage");
assertEqual(presentation.progressText, "Page 4/18", "Formal translate page unit");
}

function checkTranslateProgressTextFallbackParsesStageDetail() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      stage: "translating",
stage_detail: "Completed batch translation 1292/5216 (recent: 132)",
    },
    { items: [] },
  );
  assertEqual(presentation.stageKey, "translate", "Translate stage detail fallback stage");
assertEqual(presentation.progressText, "Batch 1292/5216", "Translate stage detail fallback progress text");
  assertEqual(presentation.progressCurrent, 1292, "Translate stage detail fallback current");
  assertEqual(presentation.progressTotal, 5216, "Translate stage detail fallback total");
}

function checkRenderZeroPageProgressShowsUsefulText() {
  const presentation = resolveDisplayedStagePresentation(
    {
      status: "running",
      stage: "rendering",
stage_detail: "Starting render of translated PDF",
    },
    {
      items: [
        {
          user_stage: "render",
          stage: "rendering",
stage_detail: "Starting render of translated PDF",
          progress_unit: "page",
          progress_current: 0,
          progress_total: 533,
        },
      ],
    },
  );
  assertEqual(presentation.stageKey, "render", "Render zero page stage");
assertEqual(presentation.progressText, "Rendering preparation, 533 pages total", "Render zero page progress text");
  assertEqual(presentation.progressCurrent, 0, "Render zero page current");
  assertEqual(presentation.progressTotal, 533, "Render zero page total");
}

checkOcrPresentationUsesPageProgress();
checkOcrPresentationIgnoresFutureStageEvents();
checkOcrPresentationFallsBackToJobProgress();
checkTranslatePresentationUsesBatchProgressWhenDetailMentionsOcr();
checkTranslatePresentationIgnoresOcrEvents();
checkContinuationReviewUsesPageProgress();
checkPagePoliciesUsePageProgress();
checkTranslateUsesLatestSubstageProgress();
checkTranslateUsesLatestProgressfulEvent();
checkOcrPercentProgressDoesNotLookLikePages();
checkOcrFallbackProgressUsesStageSteps();
checkOcrRealPageProgressIsDeterminate();
checkOcrInternalStagesUseDistinctAnimationKeys();
checkOcrResultReadyStaysInOcrStage();
checkOcrUploadWaitingDoesNotLookQueued();
checkTranslationSubstageOrderDoesNotPreferBatchWhenReviewing();
checkCompletedStageHasDoneKeyAndNoProgressTextRequirement();
checkFailedStageUsesFailureSummary();
checkRunningFinishedStageStaysInRenderUntilTerminal();
checkStartupStageUsesWorkflowContext();
checkRenderPrepareDoesNotLookLikeOcr();
checkSelectedFutureStageUsesSelectedAnimation();
checkHistoricalOcrProgressCanBeRecoveredFromEvents();
checkFormalEventContractProgressUnits();
checkOcrZeroPageProgressIsVisibleIndeterminate();
checkPageProgressBeatsLaterStepProgress();
checkCompletedOcrPageProgressBeatsPartialPageProgress();
checkFormalCurrentEventWinsStageAndUnit();
checkTranslateProgressTextFallbackParsesStageDetail();
checkRenderZeroPageProgressShowsUsefulText();

console.log("status presentation smoke passed");
