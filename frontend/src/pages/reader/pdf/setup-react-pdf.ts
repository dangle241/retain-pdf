// react-pdf / pdfjs worker 一次性配置。
// worker 走现有 vendor 拷贝，与自研 pdf-document 同源，避免 esbuild 再拆 worker。

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
