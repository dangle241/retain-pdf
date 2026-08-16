// Hợp đồng id/selector của GlossariesDialog (bản thiết kế §3 + §0.1).
//
// Sao chép từ src/js/components/dialogs/glossary-manager-dialog-dom-contract.js
// (lớp view phần tử tùy chỉnh cũ; cổng architecture-boundaries cấm src/pages/** import trực tiếp
// js/components/**); cùng cách đã dùng trong credentials-dom-ids.js.
// Literal phải khớp từng mục với hợp đồng cũ; đường cơ sở hình ảnh và cổng kiểm tra định vị chính xác theo id nên không đổi tên.

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
  ["preserve", "Giữ nguyên"],
  ["canonical", "Bản dịch cố định"],
  ["preferred", "Bản dịch ưu tiên"],
];

export const MATCH_MODE_OPTIONS = [
  ["case_insensitive", "Không phân biệt hoa thường"],
  ["exact", "Chính xác"],
  ["regex", "Biểu thức chính quy"],
];
