// app-framework/store â React adaptation hook.
//
// Landmine (verified): store.getSnapshot() returns new instance each call. frozen clone (reference unstable),
// Using directly as useSyncExternalStore's getSnapshot causes infinite re-renders.
// solution: cache subscribe snapshot carried with notification parameters (notify() generates single instance for all listeners),
// getSnapshot Read-only cache;Lazy init: read once on first access. store.getSnapshot() Initialize.
//
// selector support: shallow-compare selector cache result for high-frequency polling of large snapshots (recent-jobs)
// Trigger component re-render only when selected slice actually changes.

import { useCallback, useRef, useSyncExternalStore } from "react";

const snapshotCache = new WeakMap();

function cachedSnapshot(store) {
  if (!snapshotCache.has(store)) {
    snapshotCache.set(store, store.getSnapshot());
  }
  return snapshotCache.get(store);
}

export function shallowEqual(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => Object.is(a[key], b[key]));
}

export function useStoreSnapshot(store, selector = null, isEqual = shallowEqual) {
  const selectionRef = useRef({ hasValue: false, value: null });

  const subscribe = useCallback(
    (onStoreChange) => store.subscribe((snapshot) => {
      snapshotCache.set(store, snapshot);
      onStoreChange();
    }),
    [store],
  );

  const getSnapshot = useCallback(() => {
    const snapshot = cachedSnapshot(store);
    if (typeof selector !== "function") {
      return snapshot;
    }
    const next = selector(snapshot);
    const previous = selectionRef.current;
    if (previous.hasValue && isEqual(previous.value, next)) {
      return previous.value;
    }
    selectionRef.current = { hasValue: true, value: next };
    return next;
  }, [store, selector, isEqual]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
