// HUD số trang ở đáy: hidden ban đầu; số trang/tiến độ/nội dung chế độ do tầng view mệnh lệnh ghi
// (setPageIndicator / setReaderModeHud trong view.js, được interaction-flow điều khiển).

export function ReaderPageHud() {
  return (
    <div id="reader-page-indicator" className="reader-page-indicator reader-bottom-hud hidden" aria-live="polite">
      <span id="reader-bottom-hud-page" className="reader-bottom-hud-page">Trang 1 / 1</span>
      <span className="reader-bottom-hud-progress" aria-hidden="true">
        <span id="reader-bottom-hud-progress-bar" className="reader-bottom-hud-progress-bar"></span>
      </span>
      <span id="reader-bottom-hud-mode" className="reader-bottom-hud-mode">Đối chiếu</span>
    </div>
  );
}
