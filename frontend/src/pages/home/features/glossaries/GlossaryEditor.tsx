// Bảng trình sửa thuật ngữ, đối chiếu vùng bảng .glossary-editor-panel trong
// glossary-manager-dialog-template.js + phản chiếu từng cột view.js:appendGlossaryEntryRow.
//
// Thao tác hàng DOM mệnh lệnh → mảng có cấu trúc + kết xuất .map (bản thiết kế §3): mọi entries đến từ
// draft.entries của glossaries-store.js; mỗi ô là input/select có kiểm soát, onChange ghi trực tiếp
// store bằng updateEntryField, không còn thêm/xóa DOM cấp hàng viết tay.

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS, ENTRY_LEVEL_OPTIONS, MATCH_MODE_OPTIONS } from "./glossaries-dom-ids.js";

export function GlossaryEditor({ entries, onFieldChange, onRemoveRow }) {
  const hasEntries = entries.length > 0;
  return (
    <div className="glossary-table-wrap">
      <table className="glossary-table">
        <thead>
          <tr>
            <th className="glossary-col-source">Từ gốc</th>
            <th className="glossary-col-target">Bản dịch</th>
            <th className="glossary-col-note">Ghi chú</th>
            <th className="glossary-col-level">Loại</th>
            <th className="glossary-col-match">Khớp</th>
            <th className="glossary-col-action"></th>
          </tr>
        </thead>
        <tbody id={GLOSSARY_DOM_IDS.entries}>
          {entries.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key -- hàng không có id ổn định; code cũ cũng định vị DOM thuần, nên khóa chỉ mục tương đương hành vi cũ.
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
                  placeholder="Có thể để trống"
                  value={row.target}
                  onChange={(event) => onFieldChange(index, "target", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="glossary-entry-note"
                  placeholder="Tùy chọn"
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
                  aria-label="Xóa mục thuật ngữ"
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
            title="Chưa có mục thuật ngữ"
            hint="Thêm từ gốc và bản dịch; khi dịch, thuật ngữ của bạn sẽ được ưu tiên."
          />
        ) : null}
      </div>
    </div>
  );
}
