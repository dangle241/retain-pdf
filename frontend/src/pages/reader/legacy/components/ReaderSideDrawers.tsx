// React wrapper for four side drawers (Excerpt/Annotation/Markdown/AI), replacing old side-drawers.js
// is-open/inert Write. Preserve semantics.:
// - Mutual exclusion open/close determined by drawer store (single active);
// - favorites Drawer never inert (legacy edge case: pinned excerpt float interaction depends on it);
// - AI Drawer lacks independent close button(via right sidebar collapse handle or top bar toggle);
// - Drawer content container is imperative island: favorites list (drawer-renderer), markdown body
//   (markdown-preview) find container by id and write; React first commit, do not touch afterwards;
//   Reuse annotation panel directly. islands/reader-annotations Component source(Skip precompiled artifacts.);
//   AI thread/composer/Session bar is React (ReaderAiChat).

import { useMemo } from "react";
import { ReaderAnnotationsPanel } from "../../../../js/islands/reader-annotations/reader-annotations-app.jsx";
import { useDrawerActive } from "../state/use-drawer-active.js";
import { ReaderAiChat } from "./ReaderAiChat.jsx";

function drawerProps(active, key) {
  const open = active === key;
  return {
    className: `reader-side-drawer reader-${key}-drawer${open ? " is-open" : ""}`,
    // favorites Edge case copies legacy implementation;When other drawers close inert(Not focusable/Non-interactive)
    inert: key === "favorites" ? false : !open,
  };
}

export function ReaderFavoritesDrawer({ drawerStore }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-favorites-drawer" aria-label="Bookmark read. Check database. Optimize query." {...drawerProps(active, "favorites")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Screenshot Excerpt</strong>
          <span>Double-click selection to collapse here.</span>
        </div>
        <button
          id="reader-favorites-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Unfavorite"
          onClick={() => drawerStore.close("favorites")}
        >×</button>
      </div>
      {/* List by selection-favorites → favorites/drawer-renderer Imperative rendering(Container constant leaf) */}
      <div id="reader-favorites-list" className="reader-favorites-list"></div>
    </aside>
  );
}

export function ReaderAnnotationsDrawer({ drawerStore, ports }) {
  const active = useDrawerActive(drawerStore);
  const open = active === "annotations";
  // Port for annotation panel:boot Provide data port,Toggle subscription bridged here to drawer store
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
<aside id="reader-annotations-drawer" aria-label="Annotations" {...drawerProps(active, "annotations")}>
      <div className="reader-side-drawer-head">
        <div>
<strong>Annotations</strong>
          <span>Create from selected source,Supports notes and export.</span>
        </div>
        <button
          id="reader-annotations-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Close Annotations"
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
<aside id="reader-markdown-drawer" aria-label="Markdown Preview" {...drawerProps(active, "markdown")}>
      <div className="reader-side-drawer-head">
        <div>
<strong>Markdown Preview</strong>
<span>Recognition and Translation Output Markdown text</span>
        </div>
        <button
          id="reader-markdown-close-btn"
          type="button"
          className="reader-side-drawer-close"
aria-label="Close Markdown Preview"
          onClick={() => drawerStore.close("markdown")}
        >×</button>
      </div>
      {/* Status line separated from body by markdown-preview.js Imperative-driven(容器恒定叶子) */}
      <div className="reader-markdown-body">
<div id="reader-markdown-status" className="reader-markdown-status">Not loaded</div>
        <article id="reader-markdown-content" className="reader-markdown-content hidden"></article>
      </div>
    </aside>
  );
}

export function ReaderAiDrawer({ drawerStore, chatPorts }) {
  const active = useDrawerActive(drawerStore);
  return (
<aside id="reader-ai-drawer" aria-label="Reading Q&A" {...drawerProps(active, "ai")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Read Q&A</strong>
          <span>Ask based on current document; questioning scope can be switched.</span>
        </div>
      </div>
      <div className="reader-ai-body">
        {/* Range switch buttons and context row are ai-context.js Imperative(static skeleton,React No re-render) */}
        <div className="reader-ai-scope-block">
<div className="reader-ai-scope" role="group" aria-label="Question Scope">
            <button type="button" data-reader-ai-scope="document" className="is-active" aria-pressed="true">entire document</button>
            <button type="button" data-reader-ai-scope="page" aria-pressed="false">Current</button>
            <button type="button" data-reader-ai-scope="selection" aria-pressed="false">selection</button>
          </div>
<div id="reader-ai-context" className="reader-ai-context">Current scope: Entire document</div>
        </div>
        <ReaderAiChat ports={chatPorts} />
      </div>
    </aside>
  );
}
