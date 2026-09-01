// home pages React 入口(Phase 3a 骨架期).
//
// Current index.html 仍指向旧世界 dist/app.bundle.js;books入口只经临时开发pages
// home-react-dev.html(dist/home-react-dev.bundle.js)加载,供双轨Side-by-side.
// cutover(3b Done后)时 index.html 换 dist/home.bundle.js 指向此Files.
//
// 顺序保证(蓝图 §4):composition 先建, Events桥先绑, idle View先落 store,
// 再 createRoot().render —— useSyncExternalStore 首读即拿现值,不闪空壳.
// 与 detail/reader 先例一致:不开 StrictMode(composition 含一次性Events绑定,
// 双调用会重复 dispatch;命令式复用件与 StrictMode 解耦yes三pages统一约定).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DecorStage } from "../../shared/decor/DecorStage.jsx";
import { createHomeComposition } from "./composition.js";
import { HomeApp } from "./HomeApp.jsx";

// 尽早挂 data-theme, 减少换肤 FOUC(见 docs/theme-system/THEME_SYSTEM.md)
bootTheme();

// appUpdateAutoCheckEnabled: true——composition.js 默认Close app-update 的后台
// GitHub 自检(测试隔离,见 composition.js 头注释),生产入口这里显式打开,
// 与旧世界 bootstrap/core-app-update-runtime-port.js 的 isAppUpdateEnabled
// port 行为等价.
const services = createHomeComposition({ appUpdateAutoCheckEnabled: true });
services.initialize();

function resolveHomeRoot(body = document.body) {
  let host = document.getElementById("home-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "home-root";
    body.appendChild(host);
  }
  return host;
}

createRoot(resolveHomeRoot()).render(
  <>
    {/* 装饰舞台: None decorPack 的ThemeRendering null, 零开销(docs/theme-system/DECOR_PACKS.md) */}
    <DecorStage />
    <HomeApp services={services} />
  </>,
);




