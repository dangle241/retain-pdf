import {
  fileNameFromDisposition,
  formatTransferSize,
  prepareDownloadTarget,
  saveResponseDownload,
} from "../../utils/downloads.js";
import {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "../../utils/download-feedback.js";
import { buildErrorDiagnostic } from "../../utils/error-diagnostics.js";
import {
  downloadActionForLink,
  defaultDownloadNameResolver,
  resolveDownloadActionTarget,
} from "./download-actions.js";
import { createArtifactDownloadsRuntimePort } from "./runtime-port.js";

export function mountArtifactDownloadsFeature({
  state,
  fetchProtected,
  setText,
  runtimePort = createArtifactDownloadsRuntimePort(),
  viewPort,
  downloadNameResolver = defaultDownloadNameResolver,
}: any) {
  function summarizeDownloadProgress(receivedBytes, totalBytes, percent) {
    const receivedText = formatTransferSize(receivedBytes);
    if (Number.isFinite(totalBytes) && totalBytes > 0) {
      const totalText = formatTransferSize(totalBytes);
      const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
      return `Downloading ${receivedText} / ${totalText} (${safePercent.toFixed(0)}%)`;
    }
return receivedText ? Downloading ${receivedText} : "Downloading...";
  }

  async function handleProtectedArtifactClick(event, matchedLink = null) {
    const link = matchedLink || event.currentTarget;
    if (!link) {
      return;
    }
    const disabled = viewPort.isLinkDisabled(link);
    const url = link.dataset.url || "";
    if (disabled || !url) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setText("error-box", "-");
    const action = downloadActionForLink(link);
    const jobId = runtimePort.currentJobId(state) || "result";
    const {
      fallbackName,
      preferredName,
      preferSuggestedName,
    } = resolveDownloadActionTarget({
      action,
      state,
      jobId,
      nameResolver: downloadNameResolver,
    });
    const downloadTarget = await prepareDownloadTarget(preferredName);
    if (downloadTarget.kind === "aborted") {
      return;
    }

    try {
      viewPort.setLinkBusy(link, true, "Download in progress...");
      showDownloadPreparing(preferredName);
      const resp = await fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        const error: any = new Error(`Download failed: ${resp.status} ${text || "unknown error"}`);
        error.status = resp.status;
        error.url = url;
        throw error;
      }

      const disposition = resp.headers.get("content-disposition") || "";
      const filename = preferSuggestedName
        ? preferredName
        : fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("error-box", `Saving started ${filename}`);
viewPort.setLinkBusy(link, true, "Completed");
            completeDownloadToast(filename);
            return;
          }
          setText("error-box", summarizeDownloadProgress(receivedBytes, totalBytes, percent));
          viewPort.setLinkBusy(
            link,
            true,
Number.isFinite(percent) ? ${Math.max(0, Math.min(100, Number(percent) || 0)).toFixed(0)}% : "Downloading...",
          );
          updateDownloadProgress({
            filename,
            receivedBytes,
            totalBytes,
            percent,
          });
        },
      });
    } catch (err) {
      setText("error-box", buildErrorDiagnostic(err, {
        operation: "Download task artifact",
        url,
        jobId,
        details: {
          action,
          filename: preferredName,
        },
      }));
failDownloadToast(err.message || "Download failed");
    } finally {
      viewPort.setLinkBusy(link, false);
    }
  }

  function bindEvents() {
    viewPort.bindProtectedLinks(handleProtectedArtifactClick);
  }

  return {
    bindEvents,
    handleProtectedArtifactClick,
  };
}
