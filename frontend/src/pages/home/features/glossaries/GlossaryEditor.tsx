// Glossary editor table (side-by-side mirror of glossary-manager-dialog-template.js's
// .glossary-editor-panel table block + view.js:appendGlossaryEntryRow column by column).
//
// Imperative DOM row actions → structured array + .map rendering (blueprint §3):
// entries all come from glossaries-store.js's draft.entries; every cell is a
// controlled input/select, onChange writes directly to store (updateEntryField),
// no hand-written row-level DOM add/remove.

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS, ENTRY_LEVEL_OPTIONS, MATCH_MODE_OPTIONS } from "./glossaries-dom-ids.js";

export function GlossaryEditor({ entries, onFieldChange, onRemoveRow }) {
  const hasEntries = entries.length > 0;
  return (
    <div className="glossary-table-wrap">
      <table className="glossary-table">
        <thead>
          <tr>
            <th className="glossary-col-source">Source</th>
            <th className="glossary-col-target">Translation</th>
            <th className="glossary-col-note">Note</th>
            <th className="glossary-col-level">Type</th>
            <th className="glossary-col-match">Match</th>
            <th className="glossary-col-action"></th>
          </tr>
        </thead>
        <tbody id={GLOSSARY_DOM_IDS.entries}>
          {entries.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key -- row has no stable id (old world also pure positional DOM rows), index key equivalent to old behavior
            <tr key={index} className="glossary-entry-row">
              <td>
                <input
                  type="text"
                  className="glossary-entry-source"
                  placeholder="Hartree-Fock"
                  value={row.source}
                  onChange={(event) => onFieldChange(index, "source", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-target"
                  placeholder="Optional"
                  value={row.target}
                  onChange={(event) => onFieldChange(index, "target", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-note"
                  placeholder="Optional"
                  value={row.note}
                  onChange={(event) => onFieldChange(index, "note", event.target.value)}
                />
              </td>
              <td>
                <select
                  className="glossary-entry-level"
                  value={row.level}
                  onChange={(event) => onFieldChange(index, "level", event.target.value)}
                >
                  {ENTRY_LEVEL_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  className="glossary-entry-match"
                  value={row.match_mode}
                  onChange={(event) => onFieldChange(index, "match_mode", event.target.value)}
                >
                  {MATCH_MODE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  className="glossary-entry-remove secondary"
                  aria-label="Delete entry"
                  onClick={() => onRemoveRow(index)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div id={GLOSSARY_DOM_IDS.entriesEmpty} className={hasEntries ? "hidden" : undefined}>
        {!hasEntries ? (
          <EmptyState
            instrument="spectrum"
            title="No entries"
            hint="Add source terms and translations; they will be prioritized during translation."
          />
        ) : null}
      </div>
    </div>
  );
}



