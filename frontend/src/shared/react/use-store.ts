// app‑framework/store → React adapter hook.
//
// Gotcha (observed): store.getSnapshot() returns a fresh frozen clone each call
// (unstable reference). Using it directly as useSyncExternalStore's getSnapshot
// causes infinite re‑renders.
// Fix: cache the snapshot that arrives with subscribe notifications (notify()
// generates one copy for all listeners); getSnapshot reads from cache; first
// read lazily calls store.getSnapshot() once.
//
// selector support: shallow‑compare selector results, so large polling snapshots
// (recent‑jobs) only trigger re‑renders when the selected slice actually changes.

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


