// APP_EVENTS (document CustomEvent) → React adapter hook.
//
// Overall plan: keep all 16 retainpdf:* events as‑is, don't refactor the
// communication channel; React components consume events via this hook only,
// no manual addEventListener boilerplate.
//
// handler is stored in a ref: callers may pass inline arrow functions (new
// reference on each render), but the subscription only rebuilds when
// eventName/target changes, not on handler reference churn — avoiding
// unbind/rebind windows that can drop events (a real risk for polling‑driven pages).

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


