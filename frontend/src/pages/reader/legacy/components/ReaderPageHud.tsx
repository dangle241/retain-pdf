// 底部页码 HUD:初始 hidden,页码/进度/模式文案由命令式 view 层写入
// (view.js setPageIndicator / setReaderModeHud,经 interaction-flow 驱动)。

export function ReaderPageHud() {
  return (
    <div id="reader-page-indicator" className="reader-page-indicator reader-bottom-hud hidden" aria-live="polite">
      <span id="reader-bottom-hud-page" className="reader-bottom-hud-page">第 1 / 1 页</span>
      <span className="reader-bottom-hud-progress" aria-hidden="true">
        <span id="reader-bottom-hud-progress-bar" className="reader-bottom-hud-progress-bar"></span>
      </span>
      <span id="reader-bottom-hud-mode" className="reader-bottom-hud-mode">对照</span>
    </div>
  );
}
