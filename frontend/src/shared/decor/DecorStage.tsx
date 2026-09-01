// Stage decoration (image version): load manifest from current theme decorPack and apply decorate layers
// Named anchor on. UI Always DOM, this component only renders purely decorative——Overall aria-hidden、
// pointer-events: noneno interaction or accessibility tree participation.
//
// - Theme without decorPack (classic/night etc.): render null, zero requests, zero overhead
// - Manifest load/validation failed: console.warn silently post-render (decoration never blocks functionality)
// - model Layer always passes in this version. fallback Static graph (three Engine see roadmap section 6 step)
// - slot Locate truthy value in src/styles/core/decor-stage.css
//
// Contract:./contract.ts Â· Planner:./stage-plan.ts Â· Docs:docs/theme-system/DECOR_PACKS.md

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
  // clickQuote Quote bubble:{ slot, lines, index }Click carousel5s Auto-collapse
  const [verse, setVerse] = useState<{ slot: string; lines: string[]; index: number } | null>(null);

  // Theme switch → Switch decoration package
  useEffect(() => {
    const onThemeChange = () => setPack(currentPack());
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  // Bubble auto-close timeout. Implement: `setTimeout(() => setBubbleVisible(false), 5000);` → skipped: user interaction handling, add when needed.
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

// Load manifest â Render plan
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
console.warn(`[decor] Decoration pack ${pack} manifest validation failed:`, result.errors);
          setPlan(null);
        }
      })
      .catch((error) => {
        if (!alive) return;
console.warn(`[decor] Decoration pack ${pack} load failed:`, error);
        setPlan(null);
      });
    return () => {
      alive = false;
    };
  }, [pack]);

  // Mouse parallax:rAF Throttle, write host only CSS Variables: each layer uses its own. parallax Coefficient consumption
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
              aria-label="hear a quote"
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
