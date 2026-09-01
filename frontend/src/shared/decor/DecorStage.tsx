// 装饰舞台(图片版): 按CurrentTheme的 decorPack 加载 manifest, 把装饰层铺到
// 具名锚点上.Tools UI 永远yes DOM, books组件只Rendering纯装饰——整体 aria-hidden, 
// pointer-events: none, 不参与交互与None障碍树.
//
// - None decorPack 的Theme(classic/night 等): Rendering null, 零请求零开销
// - manifest 加载/校验Failed: console.warn 后静默不Rendering(装饰绝不阻塞Tools)
// - model 层在books版books一律走 fallback 静态图(three 引擎见路线图Page 6 step)
// - slot Locate真值在 src/styles/core/decor-stage.css
//
// 契约: ./contract.ts · 计划器: ./stage-plan.ts · Documents: docs/theme-system/DECOR_PACKS.md

import { useEffect, useRef, useState } from "react";
import { THEME_CHANGE_EVENT, getTheme, getThemeDefinition } from "../theme/theme.js";
import { planStage, type StagePlan } from "./stage-plan.js";

function currentPack(): string {
  return getThemeDefinition(getTheme())?.decorPack || "";
}

function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function DecorStage() {
  const [pack, setPack] = useState(currentPack);
  const [plan, setPlan] = useState<StagePlan | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // clickQuote 语录气泡: { slot, lines, index }, 点击轮播, 5s 自动收起
  const [verse, setVerse] = useState<{ slot: string; lines: string[]; index: number } | null>(null);

  // 换肤 → 换装饰包
  useEffect(() => {
    const onThemeChange = () => setPack(currentPack());
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  // 语录气泡自动收起
  useEffect(() => {
    if (!verse) return;
    const timer = window.setTimeout(() => setVerse(null), 5000);
    return () => window.clearTimeout(timer);
  }, [verse]);

  function showVerse(slot: string, clickQuote: string) {
    const lines = clickQuote.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setVerse((prev) =>
      prev && prev.slot === slot
        ? { slot, lines, index: (prev.index + 1) % lines.length }
        : { slot, lines, index: 0 },
    );
  }

  // 加载 manifest → Rendering计划
  useEffect(() => {
    if (!pack) {
      setPlan(null);
      return;
    }
    let alive = true;
    const assetBase = `decor/${pack}`;
    fetch(`${assetBase}/manifest.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        if (!alive) return;
        const result = planStage(json, { assetBase, reducedMotion: prefersReducedMotion() });
        if (result.ok) {
          setPlan(result.plan);
        } else {
          console.warn(`[decor] 装饰包 ${pack} manifest 校验Failed:`, result.errors);
          setPlan(null);
        }
      })
      .catch((error) => {
        if (!alive) return;
        console.warn(`[decor] 装饰包 ${pack} failed to load:`, error);
        setPlan(null);
      });
    return () => {
      alive = false;
    };
  }, [pack]);

  // 鼠标视差: rAF 节流, 只写宿主 CSS 变量, 各层用自己的 parallax 系数消费
  const hasParallax = !!plan?.layers.some((layer) => layer.parallax > 0);
  useEffect(() => {
    if (!hasParallax) return;
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const nx = (event.clientX / window.innerWidth) * 2 - 1;
        const ny = (event.clientY / window.innerHeight) * 2 - 1;
        host.style.setProperty("--decor-px", nx.toFixed(3));
        host.style.setProperty("--decor-py", ny.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasParallax]);

  if (!plan) return null;

  return (
    <div ref={hostRef} className="decor-stage">
      {plan.layers.map((layer) => (
        <div
          key={layer.key}
          className={`decor-layer decor-band-${layer.band} decor-slot-${layer.slot}`}
          style={layer.opacity !== 1 ? { opacity: layer.opacity } : undefined}
        >
          <img
            src={layer.src}
            alt=""
            draggable={false}
            style={
              layer.parallax > 0
                ? {
                    transform: `translate3d(calc(var(--decor-px, 0) * ${Math.round(layer.parallax * 200)}px), calc(var(--decor-py, 0) * ${Math.round(layer.parallax * 120)}px), 0)`,
                  }
                : undefined
            }
          />
          {layer.clickQuote ? (
            <button
              type="button"
              className="decor-hotspot"
              aria-label="听一句语录"
              onClick={() => showVerse(layer.slot, layer.clickQuote as string)}
            >
              {verse && verse.slot === layer.slot ? (
                <span className="decor-verse" role="status">
                  {verse.lines[verse.index]}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      ))}
      {plan.quote ? (
        <div
          className={`decor-layer decor-band-${plan.quote.band} decor-slot-${plan.quote.slot} decor-quote decor-quote-${plan.quote.writingMode}`}
          aria-hidden="true"
        >
          {plan.quote.text}
        </div>
      ) : null}
    </div>
  );
}




