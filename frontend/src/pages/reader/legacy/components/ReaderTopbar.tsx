// 顶栏三 tab(原文/译文/对照)。探针阶段初始渲染即 compare 激活态;
// 点击切换由 mode-controller(命令式)接管,React 不重渲染这些按钮。

export function ReaderTopbar() {
  return (
    <header className="reader-topbar">
      <div className="reader-tabs" role="tablist" aria-label="阅读模式">
        <button id="reader-tab-source" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-source" tabIndex={-1} data-reader-mode="source">原文</button>
        <button id="reader-tab-translated" type="button" className="reader-tab" role="tab" aria-selected="false" aria-controls="reader-pane-translated" tabIndex={-1} data-reader-mode="translated">译文</button>
        <button id="reader-tab-compare" type="button" className="reader-tab is-active" role="tab" aria-selected="true" aria-controls="reader-grid" data-reader-mode="compare">对照阅读</button>
      </div>
    </header>
  );
}
