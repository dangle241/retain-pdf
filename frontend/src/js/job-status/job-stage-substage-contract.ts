const SUBSTAGE_DEFINITIONS = Object.freeze([
  {
    key: "ocr_submitting",
    stageKey: "ocr",
    aliases: ["ocr_submitting"],
    label: "Start",
cardLabel: "Start",
detail: "Starting OCR sub-task",
    progressRange: [0, 5],
    defaultProgressUnit: "step",
  },
  {
    key: "ocr_upload",
    stageKey: "ocr",
    aliases: ["ocr_upload", "mineru_upload"],
    label: "Upload",
cardLabel: "Upload",
detail: "Uploading PDF",
    progressRange: [5, 15],
    defaultProgressUnit: "page",
  },
  {
    key: "ocr_processing",
    stageKey: "ocr",
    aliases: ["provider_processing", "mineru_processing", "ocr_processing"],
label: "OCR Parsing",
cardLabel: "OCR Parsing",
    detail: "Running in cloud OCR",
    progressRange: [15, 85],
    defaultProgressUnit: "page",
  },
  {
    key: "ocr_result_ready",
    stageKey: "ocr",
    aliases: ["ocr_result_ready"],
    label: "Result organizing",
cardLabel: "Result Organizing",
detail: "OCR results ready",
    progressRange: [85, 90],
    defaultProgressUnit: "step",
  },
  {
    key: "normalizing",
    stageKey: "ocr",
    aliases: ["normalizing"],
    label: "Standardize",
cardLabel: "Standardization",
detail: "Organizing... OCR results",
    progressRange: [90, 99],
    defaultProgressUnit: "step",
  },
  {
    key: "translation_prepare",
    stageKey: "translate",
    aliases: ["translation_prepare"],
label: "Translation Prep",
cardLabel: "Prep",
    detail: "Preparing translation task",
    progressRange: [0, 5],
    defaultProgressUnit: "step",
  },
  {
    key: "domain_inference",
    stageKey: "translate",
    aliases: ["domain_inference"],
    label: "domain judgment",
    cardLabel: "domain",
    detail: "Identifying document domain and terminology.",
    progressRange: [5, 10],
    defaultProgressUnit: "step",
  },
  {
    key: "page_policies",
    stageKey: "translate",
    aliases: ["page_policies", "page_policy"],
label: "Page Policy",
cardLabel: "Page Policy",
    detail: "Determining body and preserved formatting.",
    progressRange: [18, 28],
    defaultProgressUnit: "page",
  },
  {
    key: "continuation_review",
    stageKey: "translate",
    aliases: ["continuation_review", "cross_page", "cross_column"],
label: "Cross-column/page Detection",
cardLabel: "Cross-column/cross-stage",
detail: "Detecting cross-column/page continuous segments",
    progressRange: [10, 18],
    defaultProgressUnit: "page",
  },
  {
    key: "translation_batches",
    stageKey: "translate",
    aliases: ["translation_batches", "translating"],
label: "Translation",
    cardLabel: "Translation batches",
detail: "Translating body content",
    progressRange: [28, 82],
    defaultProgressUnit: "batch",
  },
  {
    key: "translation_tail_retry",
    stageKey: "translate",
    aliases: ["translation_tail_retry", "tail_retry"],
    label: "Tail Retry",
cardLabel: "Tail Retry",
    detail: "Retrying remaining translation batches",
    progressRange: [82, 88],
    defaultProgressUnit: "batch",
  },
  {
    key: "garbled_repair",
    stageKey: "translate",
    aliases: ["garbled_repair"],
    label: "Fix Garbled Text",
cardLabel: "Garbled Text Repair",
    detail: "Fixing garbled candidate segment.",
    progressRange: [88, 93],
    defaultProgressUnit: "step",
  },
  {
    key: "agent_repair",
    stageKey: "translate",
    aliases: ["agent_repair"],
    label: "Result repair",
cardLabel: "Result Repair",
detail: "Repairing translation results",
    progressRange: [93, 97],
    defaultProgressUnit: "step",
  },
  {
    key: "final_untranslated_recovery",
    stageKey: "translate",
    aliases: ["final_untranslated_recovery", "untranslated_recovery"],
    label: "Finalize",
cardLabel: "Finalization",
    detail: "Processing untranslated content",
    progressRange: [97, 99],
    defaultProgressUnit: "step",
  },
  {
    key: "render_prepare",
    stageKey: "render",
    aliases: ["render_prepare", "render_preprocess"],
label: "Prepare",
cardLabel: "Prepare",
detail: "Preparing rendering resources",
  },
  {
    key: "render_prewarm",
    stageKey: "render",
    aliases: ["render_prewarm"],
label: "Prewarm",
cardLabel: "Prewarm",
detail: "Prewarming rendering resources",
  },
  {
    key: "render_pages",
    stageKey: "render",
    aliases: ["render_pages", "rendering"],
    label: "page",
cardLabel: "Page",
    detail: "Generating page content",
  },
  {
    key: "render_compile",
    stageKey: "render",
    aliases: ["render_compile", "compile"],
label: "Compile",
cardLabel: "Compile",
detail: "Compiling PDF",
  },
]);

const SUBSTAGE_BY_KEY = Object.freeze(Object.fromEntries(
  SUBSTAGE_DEFINITIONS.map((item) => [item.key, item]),
));

const SUBSTAGE_ALIAS_TO_KEY = Object.freeze(Object.fromEntries(
  SUBSTAGE_DEFINITIONS.flatMap((item) => [
    [item.key, item.key],
    ...(item.aliases || []).map((alias) => [alias, item.key]),
  ]),
));

export function normalizeSubstageKey(value = "") {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return SUBSTAGE_ALIAS_TO_KEY[normalized] || "";
}

export function substageDefinitionForKey(key = "") {
  return SUBSTAGE_BY_KEY[normalizeSubstageKey(key) || key] || null;
}

export function substageDetail(key = "") {
  return substageDefinitionForKey(key)?.detail || "";
}

export function substageLabel(key = "") {
  return substageDefinitionForKey(key)?.label || "";
}

export function substageCardLabel(key = "") {
  const definition = substageDefinitionForKey(key);
  return definition?.cardLabel || definition?.label || "";
}

export function substagesForStage(stageKey = "") {
  const normalizedStage = `${stageKey || ""}`.trim();
  return SUBSTAGE_DEFINITIONS
    .filter((item) => item.stageKey === normalizedStage)
    .slice()
    .sort((left, right) => {
      const leftStart = Number(left.progressRange?.[0] ?? Number.POSITIVE_INFINITY);
      const rightStart = Number(right.progressRange?.[0] ?? Number.POSITIVE_INFINITY);
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      return SUBSTAGE_DEFINITIONS.indexOf(left) - SUBSTAGE_DEFINITIONS.indexOf(right);
    })
    .map((item) => ({
      key: item.key,
      label: substageCardLabel(item.key),
    }));
}

export function substageLabelsForStage(stageKey = "") {
  return Object.fromEntries(
    SUBSTAGE_DEFINITIONS
      .filter((item) => item.stageKey === stageKey)
      .map((item) => [item.key, item.label]),
  );
}

export function substageProgressRange(key = "") {
  const range = substageDefinitionForKey(key)?.progressRange;
  return Array.isArray(range) && range.length === 2 ? range : null;
}

export function substageDefaultProgressUnit(key = "") {
  return substageDefinitionForKey(key)?.defaultProgressUnit || "";
}

export function visualStageKeyForSubstage(stageKey = "", substage = "") {
  const normalizedStage = `${stageKey || ""}`.trim();
  const normalizedSubstage = normalizeSubstageKey(substage);
  if (normalizedStage === "ocr" && normalizedSubstage) {
    if (normalizedSubstage === "normalizing") {
      return "ocr_normalizing";
    }
    return normalizedSubstage;
  }
  return "";
}
