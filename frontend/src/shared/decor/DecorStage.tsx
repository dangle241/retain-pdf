// Sân khấu trang trí (bản ảnh): tải manifest theo decorPack của chủ đề hiện tại và đặt lớp trang trí vào
// neo có tên. UI chức năng luôn là DOM; component này chỉ render trang trí thuần, toàn bộ aria-hidden,
// pointer-events:none, không tham gia tương tác hay cây trợ năng.
//
// - Chủ đề không có decorPack (classic/night, v.v.): render null, không yêu cầu và không chi phí.
// - Tải/xác thực manifest thất bại: console.warn rồi âm thầm không render (trang trí tuyệt đối không chặn chức năng).
// - Trong phiên bản này, lớp model luôn dùng ảnh tĩnh fallback (xem bước 6 lộ trình cho engine Three).
// - Nguồn sự thật định vị slot nằm trong src/styles/core/decor-stage.css.
//
// Hợp đồng: ./contract.ts · Bộ lập kế hoạch: ./stage-plan.ts · Tài liệu: docs/theme-system/DECOR_PACKS.md.

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
  // Bong bóng trích dẫn clickQuote: { slot, lines, index }, bấm để luân phiên, tự đóng sau 5 giây.
  const [verse, setVerse] = useState<{ slot: string; lines: string[]; index: number } | null>(null);

  // Đổi giao diện → đổi gói trang trí.
  useEffect(() => {
    const onThemeChange = () => setPack(currentPack());
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  // Tự đóng bong bóng trích dẫn.
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

  // Tải manifest → kế hoạch render.
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
          console.warn(`[decor] kiểm tra manifest của gói trang trí ${pack} thất bại:`, result.errors);
          setPlan(null);
        }
      })
      .catch((error) => {
        if (!alive) return;
        console.warn(`[decor] tải gói trang trí ${pack} thất bại:`, error);
        setPlan(null);
      });
    return () => {
      alive = false;
    };
  }, [pack]);

  // Thị sai chuột: throttle bằng rAF, chỉ ghi biến CSS trên host; mỗi lớp dùng hệ số parallax riêng.
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
              aria-label="Nghe một câu trích dẫn"
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
