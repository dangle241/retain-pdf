// APP_EVENTS(document CustomEvent)→ React 的适配 hook.
//
// 总计划口径:16 个 retainpdf:* Events原样保留,不趁机改造通信方式;
// React 组件消费Events时统一走books hook,不手写 addEventListener 样板.
//
// handler 走 ref:调用方可以传内联箭头函数(每次Rendering都yes新引用),
// 订阅books体只随 eventName/target 变化重建,不会因 handler 引用漂移反复解绑/重绑
// (解绑窗口内丢Eventsyes轮询驱动Pages的真实风险).

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


