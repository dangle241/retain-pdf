// Cấu hình một lần worker react-pdf / pdfjs.
// Worker dùng bản vendor hiện có, cùng origin với pdf-document tự phát triển, tránh esbuild tách worker lần nữa.

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
