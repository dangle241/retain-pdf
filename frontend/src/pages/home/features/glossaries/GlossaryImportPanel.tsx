// CSV import panel (side-by-side mirror of glossary-manager-dialog-template.js's
// .glossary-import-panel block). Parse action reuses controller.js's applyImport
// (internally calls js/api/glossaries.js:parseGlossaryCsv).

import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryImportPanel({ visible, csvText, onCsvTextChange, onApply, onCancel }) {
  return (
    <div id={GLOSSARY_DOM_IDS.importPanel} className={`glossary-import-panel${visible ? "" : " hidden"}`}>
      <textarea
        id={GLOSSARY_DOM_IDS.csvText}
        rows={6}
        placeholder="Source,Translation,Type,Match mode,Note"
        value={csvText}
        onChange={(event) => onCsvTextChange(event.target.value)}
      />
      <div className="glossary-import-actions">
        <button id={GLOSSARY_DOM_IDS.importApplyButton} type="button" className="app-button" onClick={onApply}>parse</button>
        <button id={GLOSSARY_DOM_IDS.importCancelButton} type="button" className="app-button secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}




