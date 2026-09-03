// One-time react-pdf / pdfjs worker configuration.
// Worker uses the existing vendor copy, same origin as the self-developed pdf-document, avoiding esbuild splitting the worker again.

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

