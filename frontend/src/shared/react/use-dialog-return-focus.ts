// Radix Dialog return focus on close (Phase C: shadcn refactor, dialog rendering layer overhaul).
//
// Radix default "Return focus to trigger element on close" depends on DialogPrimitive.Trigger record
// context.triggerRef â but in this project, all dialogs are not "Trigger and Content in same
// subtree" classic usage of: no rendering of DialogPrimitive.Trigger (trigger buttons are all ordinary
// <button onClick={...}>,Distributed across HeroUpload/SettingsHubDialog panel/
// AppShellHeader/EventsTimeline in completely different components such as trigger cards,Status
// dialogStore.open()/APP_EVENTS/Local useState driven), Radix unknown "DeepSeek
// Opened me",Thus default onCloseAutoFocus(Try focus triggerRef.current)
// always a no-op â verified: focus moves to <body>, does not return to user's previous click.
// button. Root cause and "whether trigger button is in same React subtree as Content" is irrelevant (even within same tree,
// If unused DialogPrimitive.Trigger,Same no-op),So this project 9 Dialog
// All need this hook, do not pick and use based on "cross-subtree?".
//
// Equivalent semantics added manually here: when open changes from false â true, record current
// document.activeElement (almost always the trigger button user just clicked). When dialog closes,
// (DialogPrimitive.Content onCloseAutoFocus) return focus to it, and
// preventDefault Radix's own default behavior.
//
// Originally in src/pages/home/state/ (Phase C: 4 batch dialogs present on home page);
// Phase C finalize batch detail page's EventsTimeline and connect both modalities. After Radix Dialog,
// this hook is shared across pages (home.bundle.js + detail.bundle.js must bundle it),
// Move to src/shared/react/ with use-app-event.js/use-store.js/DownloadToastHost.jsx
// Sibling(Same for latter."Each page independently esbuild Bundle, share source."precedent)。

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
