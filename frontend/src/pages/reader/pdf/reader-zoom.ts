// Zoom percentage = proportion relative to "Entire reading area (shellWidth)". Three modes share same figures:
//
//   50%  â page width â half browser viewport (fills left pane during comparison/right side)
//   100% â page width â full reading area width (single column full width; side-by-side: horizontal overflow each side, page size identical).
//
// Never recalculate using "Current column width Ã percentage"; otherwise, 50% in comparison becomes 25% of full screen.

export const READER_ZOOM_MIN = 0.25;
export const READER_ZOOM_MAX = 1;
export const READER_ZOOM_STEP = 0.05;
/** 默认 50%Default 50%: half-screen width, fits perfectly with side-by-side comparison. */
export const READER_ZOOM_DEFAULT = 0.5;
/** @deprecated */
export const READER_ZOOM_SINGLE_DEFAULT = 0.5;
export const READER_ZOOM_COMPARE_DEFAULT = 0.5;

/** Total left/right padding within column */
export const READER_PANE_PAD_X = 16;
export const READER_PANE_FIT_GUTTER = 8;

export type ReaderZoomMode = "source" | "translated" | "compare";

export function defaultZoomForMode(_mode?: ReaderZoomMode | string): number {
  return READER_ZOOM_DEFAULT;
}

/** Internal zoom is the "occupy shell full-width ratio" 0.25â1 */
export function clampReaderZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return READER_ZOOM_DEFAULT;
  }
  return Math.min(READER_ZOOM_MAX, Math.max(READER_ZOOM_MIN, value));
}

export function stepReaderZoom(current: number, direction: 1 | -1): number {
  const next = clampReaderZoom(Number(current) + direction * READER_ZOOM_STEP);
  return Math.round(next * 100) / 100;
}

/** UI Display percentage = zoom × 100Max. 100） */
export function zoomToDisplayPercent(zoom: number): number {
  return Math.round(clampReaderZoom(zoom) * 100);
}

/** UI percentage â zoom */
export function displayPercentToZoom(percent: number): number {
  if (!Number.isFinite(percent)) {
    return READER_ZOOM_DEFAULT;
  }
  return clampReaderZoom(percent / 100);
}

/** Match half-column width (layout only, excluded from zoom Percentage semantics */
export function comparePaneWidth(shellWidth: number): number {
  const w = Number(shellWidth) || 0;
  return Math.max(160, Math.floor((w - 1) / 2));
}

/**
 * Target container available content width (deduct padding）。
* containerWidth here should be "shell width matching expected page width" = shellWidth Ã zoom.
 */
export function fitContentWidth(containerWidth: number): number {
  const raw = Number(containerWidth) || 0;
  const available = raw - READER_PANE_PAD_X - READER_PANE_FIT_GUTTER;
  return Math.max(160, Math.floor(available));
}

/**
* Get draw page width from shell full width + full-width ratio zoom.
* Source/Translation/Shared: identical zoom â same page pixel width.
 */
export function pageWidthFromShell(shellWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  const zoom = clampReaderZoom(userZoom);
// Calculate target width by ratio, then deduct padding to ensure 50% is exactly half-screen content width
  return fitContentWidth((Number(shellWidth) || 0) * zoom);
}

/**
 * @deprecated Easily misinterpreted as「Scale by column width.」Please use pageWidthFromShell(shellWidth, zoom)。
* Keep signature to prevent breaking old calls: first arg treated as shell half-width; behavior matches legacy half-column, but unit is different.
 */
export function pageWidthForPane(shellOrPaneWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  // Compatibility: handle accidental half-width input.×2 restore to shell Approximation recalculated.
  return pageWidthFromShell(shellOrPaneWidth, userZoom);
}

export function preserveScrollCenter(
  shell: HTMLElement | null | undefined,
  zoomRatio: number,
): void {
  if (!shell || !Number.isFinite(zoomRatio) || zoomRatio <= 0 || Math.abs(zoomRatio - 1) < 0.001) {
    return;
  }

  const cx = shell.scrollLeft + shell.clientWidth / 2;
  const cy = shell.scrollTop + shell.clientHeight / 2;
  const paneCenters = Array.from(
    shell.querySelectorAll<HTMLElement>("[data-reader-pane]"),
  ).map((pane) => ({
    pane,
    cx: pane.scrollLeft + pane.clientWidth / 2,
    hadOverflow: pane.scrollWidth > pane.clientWidth + 1,
  }));

  const apply = () => {
    shell.scrollLeft = Math.max(0, cx * zoomRatio - shell.clientWidth / 2);
    shell.scrollTop = Math.max(0, cy * zoomRatio - shell.clientHeight / 2);

    for (const { pane, cx: pcx, hadOverflow } of paneCenters) {
      const maxL = Math.max(0, pane.scrollWidth - pane.clientWidth);
      if (maxL <= 0) {
        pane.scrollLeft = 0;
        continue;
      }
      if (!hadOverflow) {
        pane.scrollLeft = maxL / 2;
      } else {
        pane.scrollLeft = Math.min(
          maxL,
          Math.max(0, pcx * zoomRatio - pane.clientWidth / 2),
        );
      }
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(apply);
  });
}
