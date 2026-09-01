// GlossariesDialog id/selector contract (Blueprint Â§3 + Â§0.1).
//
// Copied from src/js/components/dialogs/glossary-manager-dialog-dom-contract.js
// (Legacy custom element view layer, architecture-boundaries gate prohibits src/pages/** from directly
// import js/components/**)——Same approach already in credentials-dom-ids.js Used once.
// Literals must align one-to-one with the legacy contract.:Visual baselines and gates use these id Pinpoint,Name immutable.

export const GLOSSARY_DOM_IDS = Object.freeze({
  triggerButton: "glossary-btn",
  dialog: "glossary-manager-dialog",
  closeButton: "glossary-close-btn",
  newButton: "glossary-new-btn",
  list: "glossary-list",
  listEmpty: "glossary-list-empty",
  nameInput: "glossary-name",
  addRowButton: "glossary-add-row-btn",
  importButton: "glossary-import-btn",
  exportButton: "glossary-export-btn",
  deleteButton: "glossary-delete-btn",
  entries: "glossary-entries",
  entriesEmpty: "glossary-entries-empty",
  importPanel: "glossary-import-panel",
  csvText: "glossary-csv-text",
  importApplyButton: "glossary-import-apply-btn",
  importCancelButton: "glossary-import-cancel-btn",
  status: "glossary-status",
  saveButton: "glossary-save-btn",
});

export const ENTRY_LEVEL_OPTIONS = [
["preserve", "Preserve"],
["canonical", "Canonical"],
  ["preferred", "Preferred Translation"],
];

export const MATCH_MODE_OPTIONS = [
["case_insensitive", "Case Insensitive"],
  ["exact", "Exact"],
  ["regex", "Regex"],
];
