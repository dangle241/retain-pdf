// Cài đặt · Giao diện: chuyển giao diện chủ đề (điều khiển bằng registry, thêm giao diện sau này không cần sửa file này).
// Nguồn sự thật: html[data-theme] + localStorage (shared/theme).

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getTheme,
  listThemesBySeries,
  setTheme,
  type ThemeId,
} from "../../../../shared/theme/theme.js";

export function ThemeAppearancePanel() {
  const [active, setActive] = useState<ThemeId>(() => getTheme());
  // Chia vùng theo dòng sản phẩm (cơ bản/Bách Gia Chư Tử/triều đại/anime…), xem registry dòng sản phẩm tại
  // THEME_SERIES trong shared/theme/registry.ts; thêm một dòng cho dòng mới sẽ tạo vùng mới.
  const groups = listThemesBySeries();

  useEffect(() => {
    setActive(getTheme());
  }, []);

  function choose(id: ThemeId) {
    setTheme(id);
    setActive(id);
  }

  return (
    <div className="theme-appearance" id="theme-appearance-panel">
      {/* Phần mô tả do pane-head của panel cài đặt đảm nhiệm, không lặp lại gợi ý tại đây. */}
      {groups.map(({ series, label, themes }) => (
        <div key={series} className="theme-appearance-group" data-theme-series={series}>
          <h3 className="theme-appearance-group-title">{label}</h3>
          <div
            className="theme-appearance-grid"
            role="radiogroup"
            aria-label={`Giao diện ${label}`}
          >
            {themes.map((meta) => {
              const swatch = meta.preview;
              const selected = active === meta.id;
              // className dùng cn + literal thuần: scanner v4 không trích xuất được từ template `x${y}`
              // các tên lớp (vấn đề được ghi ở comment đầu tailwind-theme.css; theme-option từng vì vậy mà
              // mất âm thầm toàn bộ @utility).
              return (
                <button
                  key={meta.id}
                  id={`theme-option-${meta.id}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn("theme-option", selected && "is-selected")}
                  data-theme-option={meta.id}
                  data-theme-group={meta.group}
                  onClick={() => choose(meta.id)}
                >
                  <span
                    className="theme-option-swatch"
                    style={{ background: swatch.bg }}
                    aria-hidden="true"
                  >
                    <span
                      className="theme-option-swatch-paper"
                      style={{ background: swatch.paper }}
                    >
                      <span
                        className="theme-option-swatch-bar"
                        style={{ background: swatch.accent }}
                      />
                      <span
                        className="theme-option-swatch-line"
                        style={{ background: swatch.ink }}
                      />
                      <span
                        className="theme-option-swatch-line-short"
                        style={{ background: swatch.ink }}
                      />
                    </span>
                    <span
                      className="theme-option-swatch-dot"
                      style={{ background: swatch.danger }}
                    />
                  </span>
                  <span className="theme-option-copy">
                    <strong>{meta.label}</strong>
                    <span>{meta.description}</span>
                  </span>
                  {selected ? (
                    <span className="theme-option-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
