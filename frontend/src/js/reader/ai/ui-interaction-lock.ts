// AI Switch session / Branch transient isolation: prevent click-through after list collapse to PDF/Link.
// Only in lock Window-scoped. Never permanently block reading entry or normal navigation.

let lockUntil = 0;
let shieldCleanup: (() => void) | null = null;
let overlayEl: HTMLDivElement | null = null;
let openGuardInstalled = false;

export function isReaderAiNavigationLocked(now = Date.now()): boolean {
  return now < lockUntil;
}

export function lockReaderAiNavigation(durationMs = 700): void {
  const until = Date.now() + Math.max(0, durationMs);
  if (until > lockUntil) lockUntil = until;
}

/** Force release quarantine (enter page/Fallback on exception to prevent residual overlay blocking interaction. */
export function clearReaderAiNavigationLock(): void {
  lockUntil = 0;
  shieldCleanup?.();
  shieldCleanup = null;
  removeOverlay();
}

function ensureOverlay(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (overlayEl && overlayEl.isConnected) return overlayEl;
  const el = document.createElement("div");
  el.setAttribute("data-reader-ai-pointer-shield", "1");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    cursor: "progress",
    background: "transparent",
    pointerEvents: "auto",
    touchAction: "none",
  } as CSSStyleDeclaration);
  const block = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  };
  for (const type of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "auxclick",
    "dblclick",
    "contextmenu",
    "touchstart",
    "touchend",
  ] as const) {
    el.addEventListener(type, block, { capture: true, passive: false });
  }
  document.documentElement.appendChild(el);
  overlayEl = el;
  return el;
}

function removeOverlay(): void {
  if (!overlayEl) return;
  try {
    overlayEl.remove();
  } catch {
    // ignore
  }
  overlayEl = null;
}

/**
 * Temp fullscreen consumes pointer + Prevent page skip./Open chain.
 * For internal use only AI Switch chat bar / Branch, keep duration short.
 */
export function armReaderAiClickShield(
  durationMs = 700,
  options: { overlayDelayMs?: number } = {},
): void {
  lockReaderAiNavigation(durationMs);
  if (typeof document === "undefined") return;

  shieldCleanup?.();
  shieldCleanup = null;

  const until = Date.now() + Math.max(0, durationMs);
  const overlayDelay = Math.max(0, Number(options.overlayDelayMs) || 0);
  let overlayTimer: ReturnType<typeof setTimeout> | null = null;

  if (overlayDelay === 0) {
    ensureOverlay();
  } else {
    overlayTimer = setTimeout(() => {
      overlayTimer = null;
      if (Date.now() < until) ensureOverlay();
    }, overlayDelay);
  }

  const swallow = (event: Event) => {
    if (Date.now() >= until) {
      teardown();
      return;
    }
    const target = event.target;
    // Session bar / Allow answer action bar (new chat button) to prevent pointerdown Locked elements unclickable. Pointer-events disabled or z-index obscured. Verify CSS `pointer-events` and stacking context.
    if (
      target instanceof Element
      && target.closest(
        "[data-reader-ai-sessions], [data-reader-ai-actions], .aui-action-btn-branch",
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: false };
  const types = ["click", "auxclick", "dblclick", "pointerup", "mouseup"] as const;

  const teardown = () => {
    if (overlayTimer != null) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    for (const type of types) {
      document.removeEventListener(type, swallow, opts);
    }
    removeOverlay();
    if (shieldCleanup === teardown) shieldCleanup = null;
  };

  for (const type of types) {
    document.addEventListener(type, swallow, opts);
  }
  shieldCleanup = teardown;
  window.setTimeout(teardown, Math.max(0, durationMs) + 48);
}

export function shouldIgnoreReaderAiNavEvent(event: Event | null | undefined): boolean {
  if (isReaderAiNavigationLocked()) return true;
  if (!event) return false;
  // typeof Guard:node/jsdom No global MouseEventnaked instanceof Throws.
// ReferenceError and in event listener Silently swallowed here (answer-enhance test
  // False negative occurred.——Button injection succeeded but onJump Never triggers.
  if (typeof MouseEvent !== "undefined" && event instanceof MouseEvent && event.isTrusted === false) {
    return true;
  }
  return false;
}

/**
 * Only in AI Intercept during navigation lock window.open / Default link behavior.
 * Non-permanent ban Same-origin navigation prevents disrupting normal reading.
 */
export function installReaderWindowOpenGuard(): () => void {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return () => {};
  }
  if (openGuardInstalled) return () => {};
  openGuardInstalled = true;

  // Clear stale overlay on page entry.
  clearReaderAiNavigationLock();

  const original = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    // Block only during lockout (prevent accidental session switch); allow otherwise.
    if (isReaderAiNavigationLocked()) {
      return null;
    }
    return original(url as string, target, features);
  }) as typeof window.open;

  const onClickCapture = (event: Event) => {
    if (!isReaderAiNavigationLocked()) return;
    const t = event.target;
    if (!(t instanceof Element)) return;
    // Allow session bar self.
    if (t.closest("[data-reader-ai-sessions]")) return;
    const a = t.closest("a[href]");
    if (a) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  document.addEventListener("click", onClickCapture, true);

  return () => {
    window.open = original;
    document.removeEventListener("click", onClickCapture, true);
    openGuardInstalled = false;
    clearReaderAiNavigationLock();
  };
}
