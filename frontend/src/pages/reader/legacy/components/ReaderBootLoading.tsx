// StartProgress浮层:初始可见,Progress文案/Progressentries/隐藏均由命令式 view 层驱动
// (src/js/reader/view.js + progress-presenter.js),React 只Rendering一次容器.

export function ReaderBootLoading() {
  return (
    <div id="reader-boot-loading" className="reader-boot-loading" aria-live="polite">
      <div className="reader-boot-loading-card">
        <div id="reader-boot-loading-text" className="reader-boot-loading-text">Preparing side-by-side reader...</div>
        <div className="reader-boot-loading-track">
          <span id="reader-boot-loading-bar" className="reader-boot-loading-bar"></span>
        </div>
      </div>
    </div>
  );
}



