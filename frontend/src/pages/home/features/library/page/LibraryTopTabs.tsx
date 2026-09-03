// Main page top "Library / Collection / Favorite / AI Q&A" bar (bare Tabs primitive, not going through src/components/ui/tabs.jsx
// default skin — same as StatusDetailDialog/SettingsHubDialog's existing Select, use project's own
// classes, don't hook into shadcn default visuals).
//
// Iconized: each tab prefixed with semantic icon + short text (pure icon hurts wayfinding).
// Active tab is pure page-level UI state (HomeApp useState), not persisted — refresh returns to Library.

import { Tabs as TabsPrimitive } from "radix-ui";

// Library: book spines arranged on a bookshelf
function IconLibrary() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}
// Collection: stacked books
function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}
// Favorite: bookmark (paragraph-level Excerpt/Note, distinct from Collection=document grouping)
function IconBookmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
// AI Q&A: sparkles
function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.6 2.2L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.8L19 15z" />
    </svg>
  );
}

// key kept as "categories" (contract id library-top-tab-categories / test references must not change).
// "favorites" / "ask" are future entry points.
const TABS = [
  { key: "library", label: "Library", Icon: IconLibrary },
  { key: "categories", label: "Collection", Icon: IconLayers },
  { key: "favorites", label: "Favorite", Icon: IconBookmark },
  { key: "ask", label: "AI Q&A", Icon: IconSparkles },
];

export function LibraryTopTabs({ active, onChange }) {
  return (
    <TabsPrimitive.Root
      className="library-top-tabs-root"
      value={active}
      onValueChange={onChange}
    >
      <TabsPrimitive.List className="library-top-tabs" aria-label="LibraryView">
        {TABS.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            id={`library-top-tab-${tab.key}`}
            className={`library-top-tab ${active === tab.key ? "is-active" : ""}`.trim()}
          >
            <tab.Icon />
            <span>{tab.label}</span>
            {/* Decoration hook: default zero-rendering None style, skin can add graphics to tab via CSS */}
            <span className="library-top-tab-ornament" aria-hidden="true" />
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}




