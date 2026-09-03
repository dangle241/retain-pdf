// Focus return compensation after Radix Dialog closes (Stage C: shadcn migration,
// dialog rendering layer overhaul).
//
// Radix's default "return focus to trigger element" relies on DialogPrimitive.Trigger
// recording context.triggerRef — but all 9 dialogs in this codebase do NOT use
// the classic "Trigger and Content in the same subtree" pattern: nowhere is
// DialogPrimitive.Trigger rendered (trigger buttons are plain `<button onClick={...}>`,
// scattered across HeroUpload, SettingsHubDialog panels, AppShellHeader,
// EventsTimeline trigger cards, etc.; state is driven by dialogStore.open(),
// APP_EVENTS, or local useState). Radix has no way to know "who opened me",
// so its default onCloseAutoFocus (which tries to focus triggerRef.current) is
// always a no‑op — observed: focus lands on `<body>`, not the clicked button.
// This root cause is unrelated to whether the trigger button is in the same
// React subtree (even if in the same tree, without DialogPrimitive.Trigger it's
// still no‑op). Therefore all 9 dialogs need this hook uniformly; we don't
// selectively apply based on "cross‑subtree".
//
// This manually implements equivalent semantics: when open goes false→true,
// record document.activeElement (almost always the trigger button just clicked);
// when the dialog closes (DialogPrimitive.Content's onCloseAutoFocus), return
// focus to it and preventDefault Radix's own default behavior.
//
// This file used to live under src/pages/home/state/ (first 4 Stage C batches
// were home dialogs); after Stage C final batch also migrated the two
// EventsTimeline modals on detail pages to Radix Dialog, this hook became
// cross‑page shared (both home.bundle.js and detail.bundle.js need it), so it
// was moved to src/shared/react/ alongside use-app-event.js, use-store.js, and
// DownloadToastHost.jsx (the latter already follows the same pattern of "multiple
// pages each esbuild‑bundle but share the same source").

import { useEffect, useRef } from "react";

export function useDialogReturnFocus(open) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;
    }
  }, [open]);

  function onCloseAutoFocus(event) {
    event.preventDefault();
    const target = previouslyFocusedRef.current;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      target.focus();
    }
  }

  return { onCloseAutoFocus };
}




