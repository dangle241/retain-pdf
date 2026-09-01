// Settings Â· Appearance: theme skin switching (registry-driven; add skins later without modifying this file)
// Truthy:html[data-theme] + localStorage（shared/theme）

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
  // Partition by product line (Basic/Hundred Schools of Thought/Dynasty/2D…), see series registry at
// THEME_SERIES in shared/theme/registry.tsââAdd row to new series creates new partition.
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
      {/* Description text handled by settings panel's pane-head; no hint repeated here. pane-head Handle here, no repeat hint */}
      {groups.map(({ series, label, themes }) => (
        <div key={series} className="theme-appearance-group" data-theme-series={series}>
          <h3 className="theme-appearance-group-title">{label}</h3>
          <div
            className="theme-appearance-grid"
            role="radiogroup"
            aria-label={`${label}Theme`}
          >
            {themes.map((meta) => {
              const swatch = meta.preview;
              const selected = active === meta.id;
// className uses cn + Pure literal: v4 Scanner fails to extract. `x${y}` In template
              // Class name (tailwind-theme.css Header comment pitfallstheme-option Previously caused by this
              // Whole line @utility Silent loss.
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
