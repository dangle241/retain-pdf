// Four drawers (favorites/annotations/markdown/ai) open/close state source: single active mutual exclusion toggle.
// Replaces old src/js/reader/side-drawers.js state semantics; DOM writes (is-open/inert/aria-expanded)
// Reassign React Component subscription rendering,Imperative Consumer(ai-context、selection-favorites、boot Orchestration)
// Still use same store as drawerController (open/toggle/close interface signature unchanged).
//
// Preserve semantics (consistent with old side-drawers):
// - open/toggle/close notify subscribers on every call (even if active is unchanged) â old sync() ran unconditionally,
//   onActiveChanged consumers (scheduleScaleRefresh etc.) depend on this "triggers every time" beat.
// - close(name): clear only if name is not provided or name exactly matches current active.

export type DrawerActiveListener = (active: string) => void;

export function createReaderDrawerStore() {
  let active = "";
  const listeners = new Set<DrawerActiveListener>();

  function notify() {
    listeners.forEach((listener) => listener(active));
  }

  return {
// useSyncExternalStore compatibility: subscribe returns unsubscribe function; listener carries active param.
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
