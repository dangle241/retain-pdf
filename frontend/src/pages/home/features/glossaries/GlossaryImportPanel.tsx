// Bảng nhập CSV, phản chiếu vùng .glossary-import-panel trong
// glossary-manager-dialog-template.js. Thao tác phân tích dùng lại
// applyImport của controller.js, bên trong gọi js/api/glossaries.js:parseGlossaryCsv.

import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryImportPanel({ visible, csvText, onCsvTextChange, onApply, onCancel }) {
  return (
    <div id={GLOSSARY_DOM_IDS.importPanel} className={`glossary-import-panel${visible ? "" : " hidden"}`}>
      <textarea
        id={GLOSSARY_DOM_IDS.csvText}
        rows={6}
        placeholder="Từ gốc,Bản dịch,Loại,Chế độ khớp,Ghi chú"
        value={csvText}
        onChange={(event) => onCsvTextChange(event.target.value)}
      />
      <div className="glossary-import-actions">
        <button id={GLOSSARY_DOM_IDS.importApplyButton} type="button" className="app-button" onClick={onApply}>Phân tích</button>
        <button id={GLOSSARY_DOM_IDS.importCancelButton} type="button" className="app-button secondary" onClick={onCancel}>Hủy</button>
      </div>
    </div>
  );
}
