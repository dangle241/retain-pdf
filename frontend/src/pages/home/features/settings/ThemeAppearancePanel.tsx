// 设置 · 外观：主题皮肤切换（注册表驱动，后期加皮肤无需改本文件）
// 真值：html[data-theme] + localStorage（shared/theme）

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
  // 按产品系列分区（基础/诸子百家/王朝/二次元…），系列注册表见
  // shared/theme/registry.ts 的 THEME_SERIES——新系列加一行即出新分区
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
      {/* 说明文案由设置面板的 pane-head 承担，此处不再重复 hint */}
      {groups.map(({ series, label, themes }) => (
        <div key={series} className="theme-appearance-group" data-theme-series={series}>
          <h3 className="theme-appearance-group-title">{label}</h3>
          <div
            className="theme-appearance-grid"
            role="radiogroup"
            aria-label={`${label}主题`}
          >
            {themes.map((meta) => {
              const swatch = meta.preview;
              const selected = active === meta.id;
              // className 用 cn + 纯字面量：v4 扫描器提不出 `x${y}` 模板里的
              // 类名（tailwind-theme.css 头注释记录的坑，theme-option 曾因此
              // 整条 @utility 静默丢失）
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
