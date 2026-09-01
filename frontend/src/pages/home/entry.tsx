// Home page React entry (Phase 3a Skeleton phase).
//
// Current index.html still points to old world dist/app.bundle.js; entry via temp dev page only.
// Loaded via home-react-dev.html (dist/home-react-dev.bundle.js) for dual-track comparison.
// At cutover (3b completion), replace index.html with dist/home.bundle.js pointing to this file.
//
// Order guarantee (Blueprint Â§4): composition Create first, bind event bridge first, populate idle view store first,
// then createRoot().render ââ useSyncExternalStore gets current value on first read, no-flash shell.
// Consistent with detail/reader precedent: won't enable StrictMode (composition contains one-time event binding,
// Double invocation causes duplication. dispatch;Imperative reusable components and StrictMode Decoupling is a unified convention across the three pages.)。

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DecorStage } from "../../shared/decor/DecorStage.jsx";
import { createHomeComposition } from "./composition.js";
import { HomeApp } from "./HomeApp.jsx";

// Fail fast. data-theme`// TODO: remove skin switcher ponytail: keep only if product insists. Delete if unused.` FOUC(see docs/theme-system/THEME_SYSTEM.md）
bootTheme();

// appUpdateAutoCheckEnabled: true——composition.js Default off. app-update Backend
// GitHub Self-check (Test isolation, see composition.js header comments), explicitly enable production entry point here.
// Behaviorally equivalent to isAppUpdateEnabled in old world bootstrap/core-app-update-runtime-port.js.
// port Behaviorally equivalent.
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
    {/* No stage decoration. decorPack Theme rendering nullzero overhead (docs/theme-system/DECOR_PACKS.md） */}
    <DecorStage />
    <HomeApp services={services} />
  </>,
);
