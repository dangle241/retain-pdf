// 四个侧抽屉(Excerpt/annotations/Markdown/AI)的 React 壳,替代旧 side-drawers.js 的
// is-open/inert 写入.语义保全:
// - 互斥开合由 drawer store 决定(单一 active);
// - favorites 抽屉永不 inert(旧实现特例:钉住的Excerpt浮层交互依赖它);
// - AI 抽屉None独立Close按钮(走右栏折叠把手或顶栏开合);
// - 抽屉内容容器yes命令式孤岛:favorites List(drawer-renderer), markdown 正文
//   (markdown-preview)按 id 查找容器写入,React 首次 commit 后不触碰;
//   annotations面板直接复用 islands/reader-annotations 的组件源码(不再走预Compile产物);
//   AI 线程/composer/会话栏yes React(ReaderAiChat).

import { useMemo } from "react";
import { ReaderAnnotationsPanel } from "../../../../js/islands/reader-annotations/reader-annotations-app.jsx";
import { useDrawerActive } from "../state/use-drawer-active.js";
import { ReaderAiChat } from "./ReaderAiChat.jsx";

function drawerProps(active, key) {
  const open = active === key;
  return {
    className: `reader-side-drawer reader-${key}-drawer${open ? " is-open" : ""}`,
    // favorites 特例照搬旧实现;其余抽屉Close时 inert(不可聚焦/不可交互)
    inert: key === "favorites" ? false : !open,
  };
}

export function ReaderFavoritesDrawer({ drawerStore }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-favorites-drawer" aria-label="阅读Favorite" {...drawerProps(active, "favorites")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Clipped excerpt</strong>
          <span>双击框selection域收进这里</span>
        </div>
        <button
          id="reader-favorites-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="CloseFavorite"
          onClick={() => drawerStore.close("favorites")}
        >×</button>
      </div>
      {/* List由 selection-favorites → favorites/drawer-renderer 命令式Rendering(容器恒定叶子) */}
      <div id="reader-favorites-list" className="reader-favorites-list"></div>
    </aside>
  );
}

export function ReaderAnnotationsDrawer({ drawerStore, ports }) {
  const active = useDrawerActive(drawerStore);
  const open = active === "annotations";
  // annotations面板的端口:boot 提供Data端口,开合订阅在此桥接到 drawer store
  const panelPorts = useMemo(() => {
    if (!ports) {
      return null;
    }
    return {
      ...ports,
      subscribeOpen(subscriber) {
        subscriber(drawerStore.getActive() === "annotations");
        return drawerStore.subscribe((current) => subscriber(current === "annotations"));
      },
    };
  }, [ports, drawerStore]);
  return (
    <aside id="reader-annotations-drawer" aria-label="annotations" {...drawerProps(active, "annotations")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>annotations</strong>
          <span>框选SourceCreated,支持Note与导出</span>
        </div>
        <button
          id="reader-annotations-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Closeannotations"
          onClick={() => drawerStore.close("annotations")}
        >×</button>
      </div>
      <div id="reader-annotations-content" className="reader-annotations-body">
        {panelPorts ? <ReaderAnnotationsPanel ports={panelPorts} /> : null}
      </div>
    </aside>
  );
}

export function ReaderMarkdownDrawer({ drawerStore }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-markdown-drawer" aria-label="Markdown 预览" {...drawerProps(active, "markdown")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Markdown 预览</strong>
          <span>识别与Translation产出的 Markdown 文books</span>
        </div>
        <button
          id="reader-markdown-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Close Markdown 预览"
          onClick={() => drawerStore.close("markdown")}
        >×</button>
      </div>
      {/* Status行与正文由 markdown-preview.js 命令式驱动(容器恒定叶子) */}
      <div className="reader-markdown-body">
        <div id="reader-markdown-status" className="reader-markdown-status">Not loaded yet</div>
        <article id="reader-markdown-content" className="reader-markdown-content hidden"></article>
      </div>
    </aside>
  );
}

export function ReaderAiDrawer({ drawerStore, chatPorts }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-ai-drawer" aria-label="阅读问答" {...drawerProps(active, "ai")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>阅读问答</strong>
          <span>基于CurrentDocuments提问, 可切换Question scope</span>
        </div>
      </div>
      <div className="reader-ai-body">
        {/* Scope切换按钮与上下文行由 ai-context.js 命令式驱动(静态骨架,React 不重Rendering) */}
        <div className="reader-ai-scope-block">
          <div className="reader-ai-scope" role="group" aria-label="Question scope">
            <button type="button" data-reader-ai-scope="document" className="is-active" aria-pressed="true">整份Documents</button>
            <button type="button" data-reader-ai-scope="page" aria-pressed="false">Current page</button>
            <button type="button" data-reader-ai-scope="selection" aria-pressed="false">selection</button>
          </div>
          <div id="reader-ai-context" className="reader-ai-context">Current scope: entire document</div>
        </div>
        <ReaderAiChat ports={chatPorts} />
      </div>
    </aside>
  );
}




