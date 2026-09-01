// react-pdf / pdfjs worker One-time config.
// worker uses existing vendor copy, in-house pdf-document is same-origin, avoid esbuild splitting worker again.

import { pdfjs } from "react-pdf";
import { resolvePdfjsVendorUrl } from "../external.js";

let configured = false;

export function setupReactPdf() {
  if (configured) {
    return;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  configured = true;
}
