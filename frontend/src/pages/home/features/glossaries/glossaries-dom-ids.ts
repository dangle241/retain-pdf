// GlossariesDialog id/selector contract (blueprint §3 + §0.1).
//
// Copied from src/js/components/dialogs/glossary-manager-dialog-dom-contract.js
// (old custom-element view layer, architecture-boundaries gate forbids src/pages/**
// from directly importing js/components/**) — same technique already used once in
// credentials-dom-ids.js. Literals must match old contract one-to-one: visual baseline
// and gate assertions locate by these ids precisely, no renaming allowed.

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
  ["canonical", "Fixed translation"],
  ["preferred", "Preferred"],
];

export const MATCH_MODE_OPTIONS = [
  ["case_insensitive", "Ignore case"],
  ["exact", "Exact"],
  ["regex", "Regex"],
];




