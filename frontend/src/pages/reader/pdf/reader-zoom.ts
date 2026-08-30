// Phần trăm thu phóng = tỷ lệ so với "chiều rộng toàn vùng đọc (shell)"; ba chế độ dùng cùng một bộ số:
//
//   50% → chiều rộng trang ≈ nửa vùng đọc trình duyệt (vừa lấp đầy một bên trái/phải khi đối chiếu).
//   100% → chiều rộng trang ≈ toàn vùng đọc (cột đơn toàn chiều rộng; khi đối chiếu mỗi bên tràn ngang nhưng trang vẫn cùng kích thước).
//
// Tuyệt đối không tính lại theo "chiều rộng cột hiện tại × phần trăm", nếu không 50% ở chế độ đối chiếu sẽ thành 25% toàn màn hình.

export const READER_ZOOM_MIN = 0.25;
export const READER_ZOOM_MAX = 1;
export const READER_ZOOM_STEP = 0.05;
/** Mặc định 50%: rộng nửa màn hình, vừa lấp đầy hai bên khi đối chiếu. */
export const READER_ZOOM_DEFAULT = 0.5;
/** @deprecated */
export const READER_ZOOM_SINGLE_DEFAULT = 0.5;
export const READER_ZOOM_COMPARE_DEFAULT = 0.5;

/** Tổng padding trái/phải trong cột. */
export const READER_PANE_PAD_X = 16;
export const READER_PANE_FIT_GUTTER = 8;

export type ReaderZoomMode = "source" | "translated" | "compare";

export function defaultZoomForMode(_mode?: ReaderZoomMode | string): number {
  return READER_ZOOM_DEFAULT;
}

/** zoom nội bộ là "tỷ lệ so với toàn chiều rộng shell" 0.25–1. */
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

/** Phần trăm UI hiển thị = zoom × 100 (tối đa 100). */
export function zoomToDisplayPercent(zoom: number): number {
  return Math.round(clampReaderZoom(zoom) * 100);
}

/** Phần trăm UI → zoom. */
export function displayPercentToZoom(percent: number): number {
  if (!Number.isFinite(percent)) {
    return READER_ZOOM_DEFAULT;
  }
  return clampReaderZoom(percent / 100);
}

/** Chiều rộng nửa cột đối chiếu (chỉ dùng cho bố cục, không tham gia ngữ nghĩa phần trăm zoom). */
export function comparePaneWidth(shellWidth: number): number {
  const w = Number(shellWidth) || 0;
  return Math.max(160, Math.floor((w - 1) / 2));
}

/**
 * Chiều rộng nội dung khả dụng của container đích (trừ padding).
 * containerWidth tại đây phải là "chiều rộng vỏ tương ứng với chiều rộng trang mong muốn" = shellWidth × zoom.
 */
export function fitContentWidth(containerWidth: number): number {
  const raw = Number(containerWidth) || 0;
  const available = raw - READER_PANE_PAD_X - READER_PANE_FIT_GUTTER;
  return Math.max(160, Math.floor(available));
}

/**
 * Tính chiều rộng vẽ trang từ toàn chiều rộng shell + tỷ lệ zoom toàn chiều rộng.
 * Dùng chung cho bản gốc/bản dịch/đối chiếu: cùng zoom → cùng chiều rộng pixel của trang.
 */
export function pageWidthFromShell(shellWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  const zoom = clampReaderZoom(userZoom);
  // Trước tiên tính chiều rộng đích theo tỷ lệ, rồi trừ padding để bảo đảm 50% đúng bằng chiều rộng nội dung nửa màn hình.
  return fitContentWidth((Number(shellWidth) || 0) * zoom);
}

/**
 * @deprecated Dễ bị hiểu nhầm là "thu phóng theo chiều rộng cột". Hãy dùng pageWidthFromShell(shellWidth, zoom).
 * Giữ chữ ký để lời gọi cũ không hỏng: khi coi tham số đầu là nửa chiều rộng shell, hành vi khác unit nửa cột cũ.
 */
export function pageWidthForPane(shellOrPaneWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  // Tương thích: nếu truyền nhầm nửa chiều rộng cột, nhân 2 để khôi phục giá trị shell gần đúng rồi tính.
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
