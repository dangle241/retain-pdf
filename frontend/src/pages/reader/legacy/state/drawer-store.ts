// 四抽屉(favorites/annotations/markdown/ai)的开合状态源:单一 active、互斥切换。
// 替代旧 src/js/reader/side-drawers.js 的状态语义;DOM 写入(is-open/inert/aria-expanded)
// 改由 React 组件订阅渲染,命令式消费方(ai-context、selection-favorites、boot 编排)
// 仍拿同一个 store 当 drawerController 用(open/toggle/close 接口签名不变)。
//
// 语义保全(与旧 side-drawers 一致):
// - open/toggle/close 每次调用都通知订阅者(即使 active 未变)——旧 sync() 无条件跑,
//   onActiveChanged 消费方(scheduleScaleRefresh 等)依赖这个"每次都来"的节拍。
// - close(name):不传 name 或 name 恰为当前 active 时才清空。

export type DrawerActiveListener = (active: string) => void;

export function createReaderDrawerStore() {
  let active = "";
  const listeners = new Set<DrawerActiveListener>();

  function notify() {
    listeners.forEach((listener) => listener(active));
  }

  return {
    // useSyncExternalStore 兼容:subscribe 返回退订函数;监听器随参携带 active
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
