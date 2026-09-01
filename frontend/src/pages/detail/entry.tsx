// detail 页 React 入口:挂载到 detail.html 的 #detail-root。
// 打包产物为 dist/detail.bundle.js(见 scripts/build-js-bundle.mjs)。

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DetailApp } from "./DetailApp.jsx";

bootTheme();

const host = document.getElementById("detail-root");
if (host) {
  createRoot(host).render(<DetailApp />);
}
