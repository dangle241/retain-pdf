import {
  canonicalStageOf,
  hasCanonicalEventContract,
} from "./job-stage-presentation-utils.js";
import {
  substageDetail,
  substageLabel,
} from "./job-stage-substage-contract.js";
import {
  stageSubtypeOfPayload,
} from "./job-stage-substage-adapter.js";
import { firstNonEmpty } from "./job-status-summary-helpers.js";
import {
  USER_STAGE_FLOW,
  USER_STAGE_TOTAL,
} from "./job-status-summary-stage-constants.js";
import { isJobTerminal } from "../job/core.js";

function publicStageKeyOf(payload) {
  const canonicalStage = canonicalStageOf(payload);
  if (canonicalStage) {
    return canonicalStage;
  }
  return "";
}

function stageKeyOf(payload) {
  const publicStageKey = publicStageKeyOf(payload);
  if (publicStageKey) {
    return publicStageKey;
  }
  if (hasCanonicalEventContract(payload)) {
    return "";
  }
  return "";
}

function stageSubtypeOf(payload) {
  return stageSubtypeOfPayload(payload);
}

function stageFlowForKey(stageKey) {
  return USER_STAGE_FLOW.find((stage) => stage.key === stageKey) || null;
}

function normalizedStageText(payload) {
  const stageKey = stageKeyOf(payload);
  const substage = firstNonEmpty(payload.substage, payload.payload?.substage);
  return `${stageKey} ${substage}`.toLowerCase();
}

function detailForPayload(payload, fallback) {
  const subtype = stageSubtypeOf(payload);
  const detail = subtype ? substageDetail(subtype) : "";
  if (detail) {
    return detail;
  }
  return fallback;
}

function userStageFor(payload) {
  const stageKey = stageKeyOf(payload);
  if (payload.status === "succeeded" && isJobTerminal(payload)) {
    return {
      key: "done",
label: "Complete",
detail: "Translated PDF generated",
      step: USER_STAGE_TOTAL,
      total: USER_STAGE_TOTAL,
    };
  }
  if (payload.status === "failed") {
    return {
      key: "failed",
label: "Failed",
      detail: "Task failed. View details.",
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  if (payload.status === "canceled") {
    return {
      key: "canceled",
      label: "Canceled",
detail: "Task canceled",
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  if (
    (payload.status === "queued"
      || stageKey === "queued")
    && !["ocr", "translate", "render"].includes(stageKey)
  ) {
    return {
      key: "queued",
label: "Queued",
      detail: detailForPayload(payload, "Waiting for execution slot"),
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  const directStage = stageFlowForKey(stageKey);
  if (directStage) {
    const matchIndex = USER_STAGE_FLOW.findIndex((stage) => stage.key === directStage.key);
    return {
      ...directStage,
      detail: detailForPayload(payload, directStage.detail),
      step: matchIndex + 1,
      total: USER_STAGE_TOTAL,
    };
  }
  if (payload.status === "running") {
    return {
      key: "running",
label: "Processing",
      detail: detailForPayload(payload, "Processing task"),
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  return {
    key: "idle",
label: "Idle",
detail: "Waiting for task to start",
    step: null,
    total: USER_STAGE_TOTAL,
  };
}

function userStageLabel(payload) {
  const stage = userStageFor(payload);
  if (stage.step && stage.total && !isJobTerminal(payload)) {
    const subtype = stageSubtypeOf(payload);
    const subtypeLabel = substageLabel(subtype) || stage.label;
return `Step ${stage.step}/${stage.total} Â· ${subtypeLabel}`;
  }
  return stage.label;
}

export {
  USER_STAGE_FLOW,
  USER_STAGE_TOTAL,
  detailForPayload,
  normalizedStageText,
  publicStageKeyOf,
  stageFlowForKey,
  stageKeyOf,
  stageSubtypeOf,
  userStageFor,
  userStageLabel,
};
