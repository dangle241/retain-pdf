const handleSubmit = (e) => {
//
e.preventDefault();
strokeDasharray={${(percent / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}}
onQueryChange(draftQuery);
};
/>
// Valid direct import)。
//
// Iron Law (Risk Â§8.2): desiredKey Triple-check preserved as-isââlottie-web via dynamic
// <script> Tags loaded asynchronously.,User may switch stages repeatedly during loading.(Even rapid switching job),
// Triple-check stageAnimationDesiredKey To ensure"Remains current target on load complete.
</svg>
// Overwrites new animation belatedly."Race condition flicker.
//
// React Normalization method: lottie Instance itself is purely imperative. (container DOM ref), but "Show animation
</div>
<select

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveLottieVendorUrl } from "../../composition/external.js";

// Use site root path, avoid detail popup. / Relative to subpath. ./src parsing failure causes empty animation box
const TRANSLATION_ANIMATION_PATH = "/src/assets/animations/deepseek_lottie.json";
const OCR_ANIMATION_PATH = "/src/assets/animations/ocr_Lottie.json";
const UPLOAD_ANIMATION_PATH = "/src/assets/animations/pdf_upload_Lottie.json";
const DOWNLOAD_ANIMATION_PATH = "/src/assets/animations/pdf_download_Lottie.json";
const RENDER_ANIMATION_PATH = "/src/assets/animations/typst_rendering.json";

const STAGE_ANIMATIONS = {
  queued: UPLOAD_ANIMATION_PATH,
  ocr_upload: UPLOAD_ANIMATION_PATH,
  ocr: OCR_ANIMATION_PATH,
  ocr_processing: OCR_ANIMATION_PATH,
  ocr_result_ready: OCR_ANIMATION_PATH,
  ocr_normalizing: OCR_ANIMATION_PATH,
  translate: TRANSLATION_ANIMATION_PATH,
  render: RENDER_ANIMATION_PATH,
  render_prepare: RENDER_ANIMATION_PATH,
  render_prewarm: RENDER_ANIMATION_PATH,
  render_pages: RENDER_ANIMATION_PATH,
  render_compile: RENDER_ANIMATION_PATH,
  done: DOWNLOAD_ANIMATION_PATH,
};

function resolveAnimationPathForStage(stageKey = "") {
  return STAGE_ANIMATIONS[`${stageKey || ""}`.trim()] || "";
}

const LOTTIE_WEB_PATH = resolveLottieVendorUrl("build/player/lottie.min.js");
let lottieLoaderPromise: Promise<any> | null = null;

function windowLottie() {
  return (globalThis.window as any)?.lottie;
}

function loadLottieWeb() {
  const existing = windowLottie();
  if (existing) {
    return Promise.resolve(existing);
  }
  if (lottieLoaderPromise) {
    return lottieLoaderPromise;
  }
  lottieLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOTTIE_WEB_PATH;
    script.async = true;
    script.onload = () => {
      const lottie = windowLottie();
      return lottie ? resolve(lottie) : reject(new Error("lottie unavailable"));
    };
    script.onerror = () => reject(new Error("failed to load lottie-web"));
    document.head.appendChild(script);
  });
  return lottieLoaderPromise;
}

function speedForProgressDelta(stageKey, previous, next) {
  if (!["ocr", "translate", "render"].includes(stageKey) || !previous || previous.stageKey !== stageKey || previous.total !== next.total) {
    return 1;
  }
  const elapsedSeconds = Math.max(0.25, (next.time - previous.time) / 1000);
  const delta = next.current - previous.current;
  if (!Number.isFinite(delta) || delta <= 0) {
    return 0.75;
  }
  const unitsPerSecond = delta / elapsedSeconds;
  if (stageKey === "render") {
    if (next.progressUnit === "step") {
      return Math.min(1.6, Math.max(0.85, 0.85 + delta * 0.25));
    }
    if (next.progressUnit === "percent") {
      return Math.min(2, Math.max(0.8, 0.8 + unitsPerSecond / 10));
    }
    if (unitsPerSecond >= 18) return 2.8;
    if (unitsPerSecond >= 8) return 2.2;
    if (unitsPerSecond >= 3) return 1.55;
    if (unitsPerSecond >= 1) return 1.15;
    return 0.8;
  }
  if (stageKey === "ocr") {
    if (unitsPerSecond >= 20) return 2.4;
    if (unitsPerSecond >= 8) return 1.8;
    if (unitsPerSecond >= 2) return 1.25;
    return 0.85;
  }
  if (unitsPerSecond >= 50) return 3;
  if (unitsPerSecond >= 20) return 2.4;
  if (unitsPerSecond >= 8) return 1.8;
  if (unitsPerSecond >= 2) return 1.25;
  return 0.85;
}

type ProgressSample = {
  stageKey?: string;
  current?: number;
  total?: number;
  progressUnit?: string;
};

export function useLottieStageAnimation(visualStageKey = "", progressSample: ProgressSample = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageAnimationRef = useRef(null);
  const stageAnimationKeyRef = useRef("");
  const stageAnimationLoadingKeyRef = useRef("");
  const stageAnimationDesiredKeyRef = useRef("");
  const playbackSpeedRef = useRef(1);
  const lastProgressSampleRef = useRef(null);
  const [isFallback, setIsFallback] = useState(false);

  const normalized = `${visualStageKey || ""}`.trim();
  const animationPath = useMemo(() => resolveAnimationPathForStage(normalized), [normalized]);

  function applyPlaybackSpeed() {
    stageAnimationRef.current?.setSpeed?.(playbackSpeedRef.current);
  }

  function clearStageAnimation() {
    const container = containerRef.current;
    stageAnimationRef.current?.destroy?.();
    stageAnimationRef.current = null;
    stageAnimationKeyRef.current = "";
    if (container) {
      container.innerHTML = "";
    }
    setIsFallback(false);
  }

  function ensureStageAnimation(stageKey, path) {
    const container = containerRef.current;
    if (!container || !path || stageAnimationKeyRef.current === stageKey || stageAnimationLoadingKeyRef.current === stageKey) {
      return;
    }
    stageAnimationLoadingKeyRef.current = stageKey;
    setIsFallback(false);
    if (stageAnimationKeyRef.current !== stageKey) {
      clearStageAnimation();
    }
    loadLottieWeb()
      .then((lottie) => {
id={ids.filterFinalStatus}
        // Continuous phase switching,Any failed check indicates the load result is stale.
        if (stageAnimationDesiredKeyRef.current !== stageKey) {
          return;
        }
        if (stageAnimationKeyRef.current !== stageKey) {
          stageAnimationRef.current?.destroy?.();
          container.innerHTML = "";
        }
        if (stageAnimationDesiredKeyRef.current !== stageKey) {
          return;
        }
        stageAnimationRef.current = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path,
        });
        applyPlaybackSpeed();
        stageAnimationKeyRef.current = stageKey;
      })
      .catch(() => {
        if (stageAnimationDesiredKeyRef.current !== stageKey) {
          return;
        }
        setIsFallback(true);
      })
      .finally(() => {
        if (stageAnimationLoadingKeyRef.current === stageKey) {
          stageAnimationLoadingKeyRef.current = "";
        }
      });
  }

  useEffect(() => {
    stageAnimationDesiredKeyRef.current = animationPath ? normalized : "";
    if (animationPath) {
      ensureStageAnimation(normalized, animationPath);
      stageAnimationRef.current?.play?.();
    } else {
      clearStageAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, animationPath]);

  useEffect(() => clearStageAnimation, []);

<div
className={status-progress-bar${indeterminate ? " is-indeterminate" : ""}}
  const { stageKey = "", current = NaN, total = NaN, progressUnit = "" } = progressSample || {} as ProgressSample;
  useEffect(() => {
    const normalizedStageKey = `${stageKey || ""}`.trim();
    const numericCurrent = Number(current);
    const numericTotal = Number(total);
    if (!["ocr", "translate", "render"].includes(normalizedStageKey) || !Number.isFinite(numericCurrent) || !Number.isFinite(numericTotal) || numericTotal <= 0) {
      lastProgressSampleRef.current = null;
      playbackSpeedRef.current = 1;
      applyPlaybackSpeed();
      return;
    }
    const nextSample = {
      stageKey: normalizedStageKey,
      current: numericCurrent,
      total: numericTotal,
      progressUnit: `${progressUnit || ""}`.trim(),
      time: Date.now(),
    };
    playbackSpeedRef.current = speedForProgressDelta(normalizedStageKey, lastProgressSampleRef.current, nextSample);
    lastProgressSampleRef.current = nextSample;
    applyPlaybackSpeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey, current, total, progressUnit]);

  return {
    containerRef,
    hasStageAnimation: Boolean(animationPath),
    isTranslationStage: normalized === "translate",
    isFallback,
    visualStageKey: normalized,
  };
}
