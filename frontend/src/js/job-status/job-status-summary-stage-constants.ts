export const USER_STAGE_FLOW = [
  {
    key: "ocr",
label: "OCR Parsing",
detail: "Identifying PDF content",
    matches: ["ocr", "parse", "mineru", "paddle", "normaliz", "document", "submit", "startup"],
  },
  {
    key: "translate",
label: "Translation",
detail: "Translating body content",
    matches: ["translat"],
  },
  {
    key: "render",
label: "Rendering",
detail: "Generating translated PDF",
    matches: ["render", "sav"],
  },
];

export const USER_STAGE_TOTAL = USER_STAGE_FLOW.length + 1;
