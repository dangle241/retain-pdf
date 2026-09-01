// Radix Dialog Close后的焦点归还补偿(Stage C:shadcn 改造,dialog Rendering层换血).
//
// Radix 默认的"Close后焦点归还触发元素"依赖 DialogPrimitive.Trigger 记录
// context.triggerRef——但booksitems目 9 个对话框All不yes"Trigger 和 Content 同一
// 子树"的Classic用法:没有一处Rendering DialogPrimitive.Trigger(触发按钮都yes普通
// <button onClick={...}>,m散在 HeroUpload/SettingsHubDialog 面板/
// AppShellHeader/EventsTimeline 触发卡片等完全不同的组件里,Status经
// dialogStore.open()/APP_EVENTS/books地 useState 驱动),Radix Cannot知道"yes谁
// 打开了我",于yes默认的 onCloseAutoFocus(尝试 focus triggerRef.current)
// 永远yes no-op——实测验证:Close后焦点会落到 <body>,不会回到用户刚才点击
// 的按钮.这个Root Cause和"触发按钮yesno与 Content 同一 React 子树"None关(即使同树,
// 只要没用 DialogPrimitive.Trigger,同样yes no-op),所以booksitems目 9 个对话框
// 统一都required这个 hook,不按"yesno跨子树"挑着用.
//
// 这里手动补上等价语义:open 从 false→true 的那一刻,记下当时的
// document.activeElement(几乎总yes用户刚点击的触发按钮),对话框Close时
// (DialogPrimitive.Content 的 onCloseAutoFocus)把焦点还给它,并
// preventDefault 掉 Radix 自己的默认行为.
//
// booksFiles原先在 src/pages/home/state/ 下(Stage C 前 4 batches对话框都在 home pages);
// Stage C 收官batches把 detail pages的 EventsTimeline 两个模态也接入 Radix Dialog 后,
// 这个 hook 变成跨pagestotal享(home.bundle.js + detail.bundle.js 都要打包它),
// 挪到 src/shared/react/ 与 use-app-event.js/use-store.js/DownloadToastHost.jsx
// 同级(后者也yes同样"多Pages各自 esbuild 打包但total享同一份源码"的先例).

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




