// GlossaryEdit器表格(Side-by-side glossary-manager-dialog-template.js 的
// .glossary-editor-panel 表格区块 + view.js:appendGlossaryEntryRow 逐列镜像).
//
// 命令式 DOM 行Action → 结构化数组 + .map Rendering(蓝图 §3):entries All来自
// glossaries-store.js 的 draft.entries,每格yes受控 input/select,onChange 直接
// 写 store(updateEntryField),不再手写行级 DOM 增删.

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS, ENTRY_LEVEL_OPTIONS, MATCH_MODE_OPTIONS } from "./glossaries-dom-ids.js";

export function GlossaryEditor({ entries, onFieldChange, onRemoveRow }) {
  const hasEntries = entries.length > 0;
  return (
    <div className="glossary-table-wrap">
      <table className="glossary-table">
        <thead>
          <tr>
            <th className="glossary-col-source">原词</th>
            <th className="glossary-col-target">Translation</th>
            <th className="glossary-col-note">备注</th>
            <th className="glossary-col-level">Type</th>
            <th className="glossary-col-match">匹配</th>
            <th className="glossary-col-action"></th>
          </tr>
        </thead>
        <tbody id={GLOSSARY_DOM_IDS.entries}>
          {entries.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key -- 行None稳定 id(旧世界也yes纯位置化 DOM 行),索引键与旧行为等价
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
                  placeholder="可留空"
                  value={row.target}
                  onChange={(event) => onFieldChange(index, "target", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-note"
                  placeholder="可选"
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
                  aria-label="Delete词entries"
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
            title="No 词entries"
            hint="添加原词与Translation, Translation时会优先用你的术语."
          />
        ) : null}
      </div>
    </div>
  );
}



