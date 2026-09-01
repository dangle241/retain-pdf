// Homepage header "Library / Collections / Favorites / AI Q&A" Columns (raw Tabs primitive, bypassing src/components/ui/tabs.jsx
// Default skin â same as StatusDetailDialog/SettingsHubDialog existing choice of, use project's own
// class,Reject shadcn Default visual)。
//
// Iconify: each tab leading semantic icon + short text (icon-only damages wayfinding).
// Activate tab Pure page-level UI state(HomeApp useState),Not persisted——Refresh to return to Library.

import { Tabs as TabsPrimitive } from "radix-ui";

// Library: Spines arranged on bookshelf
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
// Collections: Stacked books
function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}
// Favorites: Bookmark (Paragraph-level excerpt/Notes, with collection=Document group distinction)
function IconBookmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
// AI Q&A: Sparkles
function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.6 2.2L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.8L19 15z" />
    </svg>
  );
}

// key Keep "categories" (contract id library-top-tab-categories / Test reference unchanged).
// "favorites" / "ask" For future entry point.
const TABS = [
  { key: "library", label: "Library", Icon: IconLibrary },
  { key: "categories", label: "合集", Icon: IconLayers },
  { key: "favorites", label: "收藏", Icon: IconBookmark },
  { key: "ask", label: "AI 问答", Icon: IconSparkles },
];

export function LibraryTopTabs({ active, onChange }) {
  return (
    <TabsPrimitive.Root
      className="library-top-tabs-root"
      value={active}
      onValueChange={onChange}
    >
      <TabsPrimitive.List className="library-top-tabs" aria-label="Library View">
        {TABS.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            id={`library-top-tab-${tab.key}`}
            className={`library-top-tab ${active === tab.key ? "is-active" : ""}`.trim()}
          >
            <tab.Icon />
            <span>{tab.label}</span>
            {/* Decoration hook: default no-style zero-render, skin can CSS in to tab skin swapping */}
            <span className="library-top-tab-ornament" aria-hidden="true" />
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
