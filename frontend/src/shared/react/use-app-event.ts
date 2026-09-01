// APP_EVENTS(document CustomEvent)→ React Adaptation hook。
//
// Total plan scope: 16 retainpdf:* Preserve events as-is, refrain from refactoring communication methods opportunistically.
// React Route component event consumption through this. hook,Do not write manually. addEventListener Boilerplate.
//
// handler via ref: Callers can pass inline arrow functions (new reference on every render),
// Subscription body only rebuilds with eventName/target Rebuild on change.,Won't due to handler Fix reference drift causing repeated unbinding./Rebind
// (Event loss during unbinding window is a real risk for polling-driven pages.)。

import { useEffect, useRef } from "react";

export function useAppEvent(eventName, handler, { target = null } = {}) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventName) {
      return undefined;
    }
    const eventTarget = target || globalThis.document;
    if (!eventTarget?.addEventListener) {
      return undefined;
    }
    const listener = (event) => handlerRef.current?.(event);
    eventTarget.addEventListener(eventName, listener);
    return () => eventTarget.removeEventListener(eventName, listener);
  }, [eventName, target]);
}
