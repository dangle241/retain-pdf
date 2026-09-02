// Home page React entry (Phase 3a skeleton).
//
// Current index.html still points at the old-world dist/app.bundle.js; this entry is only
// loaded via the temporary dev page home-react-dev.html (dist/home-react-dev.bundle.js) for dual-track side-by-side.
// At cutover (after 3b is done) index.html switches to dist/home.bundle.js pointing at this file.
//
// Order guarantee (blueprint §4): build composition first, bind the event bridge, drop idle view into the store,
// then createRoot().render —— useSyncExternalStore's first read already has the current value, no empty-shell flash.
// Same as the detail/reader precedent: no StrictMode (composition has one-shot event bindings;
// double invoke would dispatch twice; decoupling imperative reuse from StrictMode is the three-page convention).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DecorStage } from "../../shared/decor/DecorStage.jsx";
import { createHomeComposition } from "./composition.js";
import { HomeApp } from "./HomeApp.jsx";

// Hang data-theme as early as possible to reduce theme-switch FOUC (see docs/theme-system/THEME_SYSTEM.md)
bootTheme();

// appUpdateAutoCheckEnabled: true——composition.js defaults to closing app-update's background
// GitHub self-check (test isolation; see composition.js header comment). The production entry
// turns it on here, equivalent to the old-world bootstrap/core-app-update-runtime-port.js
// isAppUpdateEnabled port.
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
    {/* Decor stage: themes with no decorPack render null, zero cost (docs/theme-system/DECOR_PACKS.md) */}
    <DecorStage />
    <HomeApp services={services} />
  </>,
);




