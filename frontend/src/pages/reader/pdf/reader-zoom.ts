// Zoom percentage = ratio relative to the full reading area (shell) width, same values for all 3 modes:
//
//   50%  → page width ≈ half the browser reading area (Side-by-side fills left/right panel exactly)
//   100% → page width ≈ full reading area width (single column full-width; Side-by-side each side overflows but pages are same size)
//
// Must NOT compute as "current column width × percentage" again -- otherwise Side-by-side 50% becomes 25% of full screen.

export const READER_ZOOM_MIN = 0.25;
export const READER_ZOOM_MAX = 1;
export const READER_ZOOM_STEP = 0.05;
/** Default 50%: half-screen width, Side-by-side both panels fill exactly */
export const READER_ZOOM_DEFAULT = 0.5;
/** @deprecated */
export const READER_ZOOM_SINGLE_DEFAULT = 0.5;
export const READER_ZOOM_COMPARE_DEFAULT = 0.5;

/** Total left+right padding within a column */
export const READER_PANE_PAD_X = 16;
export const READER_PANE_FIT_GUTTER = 8;

export type ReaderZoomMode = "source" | "translated" | "compare";

export function defaultZoomForMode(_mode?: ReaderZoomMode | string): number {
  return READER_ZOOM_DEFAULT;
}

/** Internal zoom = ratio of shell full width, range 0.25–1 */
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

/** UI display percentage = zoom × 100 (max 100) */
export function zoomToDisplayPercent(zoom: number): number {
  return Math.round(clampReaderZoom(zoom) * 100);
}

/** UI percentage → zoom */
export function displayPercentToZoom(percent: number): number {
  if (!Number.isFinite(percent)) {
    return READER_ZOOM_DEFAULT;
  }
  return clampReaderZoom(percent / 100);
}

/** Side-by-side half-column width (layout only, not part of zoom percentage semantics) */
export function comparePaneWidth(shellWidth: number): number {
  const w = Number(shellWidth) || 0;
  return Math.max(160, Math.floor((w - 1) / 2));
}

/**
 * Target container ready content width (after padding deduction).
 * containerWidth here should be the shell width corresponding to the desired page width = shellWidth × zoom.
 */
export function fitContentWidth(containerWidth: number): number {
  const raw = Number(containerWidth) || 0;
  const available = raw - READER_PANE_PAD_X - READER_PANE_FIT_GUTTER;
  return Math.max(160, Math.floor(available));
}

/**
 * Derives the rendered page width from shell full width + width ratio via zoom.
 * Used by Source/Translation/Side-by-side: same zoom → same page pixel width.
 */
export function pageWidthFromShell(shellWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  const zoom = clampReaderZoom(userZoom);
  // Derive target width by ratio, then subtract padding to ensure 50% = exactly half-screen content width
  return fitContentWidth((Number(shellWidth) || 0) * zoom);
}

/**
 * @deprecated Misleading name suggests "scale by column width". Use pageWidthFromShell(shellWidth, zoom).
 * Preserving signature to avoid breaking old callers: passing pane half-width as first arg produces
 * behavior different from the old half-column unit.
 */
export function pageWidthForPane(shellOrPaneWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  // Compatibility: if accidentally passed half-column width, ×2 to recover approximate shell width before computing
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



