// Four drawers (favorites/annotations/markdown/ai) open/close status source: single active, mutually exclusive toggle.
// Replaces old status semantics from src/js/reader/side-drawers.js; DOM writes (is-open/inert/aria-expanded)
// changed to be subscribed by React components for rendering; imperative consumers (ai-context, selection-favorites, boot orchestration)
// still use the same store as drawerController (open/toggle/close interface signatures unchanged).
//
// Semantic preservation (consistent with old side-drawers):
// - open/toggle/close notify subscribers on every call (even if active unchanged)——old sync() ran no entries,
//   onActiveChanged consumers (scheduleScaleRefresh etc.) rely on this "every call" cadence.
// - close(name): clears only when no name is passed or name matches current active.

export type DrawerActiveListener = (active: string) => void;

export function createReaderDrawerStore() {
  let active = "";
  const listeners = new Set<DrawerActiveListener>();

  function notify() {
    listeners.forEach((listener) => listener(active));
  }

  return {
    // useSyncExternalStore compatible: subscribe returns unsubscribe function; listener carries active as parameter
    subscribe(listener: DrawerActiveListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getActive: () => active,
    active: () => active,
    open(name) {
      active = name;
      notify();
      return active;
    },
    toggle(name) {
      active = active === name ? "" : name;
      notify();
      return active;
    },
    close(name = "") {
      if (!name || active === name) {
        active = "";
      }
      notify();
      return active;
    },
  };
}


