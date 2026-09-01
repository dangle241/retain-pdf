// detail page React entry: Mount to detail.html #detail-root.
// Build output is dist/detail.bundle.js (see scripts/build-js-bundle.mjs).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DetailApp } from "./DetailApp.jsx";

bootTheme();

const host = document.getElementById("detail-root");
if (host) {
  createRoot(host).render(<DetailApp />);
}
