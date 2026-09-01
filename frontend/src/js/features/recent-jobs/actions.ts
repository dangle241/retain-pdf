import { resolveRecoverableJobId } from "./active-job-recovery.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";
import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsNavigationPort } from "./navigation-port.js";

export function createRecentJobActions({
  apiPrefix,
  deleteLibraryBook,
  startPolling,
  openReader,
  currentJobId = () => "",
  jobRuntimePort = createRecentJobsRuntimePort({
    openJob: startPolling,
    currentJobId,
  }),
  readerPort = createRecentJobsReaderPort({
    openReader,
  }),
  closeRecentJobsDialog,
  activeJobRecoveryPort,
  navigationPort = createRecentJobsNavigationPort({
    closeDialog: closeRecentJobsDialog,
    currentJobId,
    jobRuntimePort,
    readerPort,
  }),
  renderCurrentRecentJobs,
  renderRecentJobsEmpty,
  renderRecentJobsError,
  statePort,
}: any) {
  let activeJobRecoveryAttempted = false;

  function selectJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
renderRecentJobsError("This task is missing job_id; cannot open.", { reset: false });
      return;
    }
    navigationPort.openJob(normalizedJobId);
  }

// 409 = delete protection: this job is referenced by favorites, cannot auto-force; user must process favorites first.
  function friendlyDeleteError(error) {
    const message = `${error?.message || error || ""}`;
    if (error?.status === 409 || message.includes("(409)")) {
      const count = message.match(/\d+/)?.[0];
      return count
? This document has ${count} collection references; delete collection before deleting document.
        : "Document has collection references. Delete related collections first.";
    }
return message || "Delete failed";
  }

  async function deleteJob(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId || !deleteLibraryBook) {
      return;
    }
    try {
      await deleteLibraryBook(apiPrefix, normalizedJobId);
    } catch (error) {
      renderRecentJobsError(friendlyDeleteError(error), { reset: false });
      return;
    }
    statePort.removeJobFamily(normalizedJobId);
    const nextItems = statePort.getSnapshot().items;
    if (nextItems.length === 0) {
renderRecentJobsEmpty("No recent tasks");
      return;
    }
    renderCurrentRecentJobs({ reset: true });
  }

  function openJobReader(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
renderRecentJobsError("This task is missing job_id, cannot open side-by-side reading.", { reset: false });
      return;
    }
    navigationPort.openReader(normalizedJobId);
  }

  function recoverActiveJob(items = []) {
    if (activeJobRecoveryAttempted) {
      return;
    }
    if (navigationPort.currentJobId()) {
      activeJobRecoveryAttempted = true;
      return;
    }
    activeJobRecoveryAttempted = true;
    const jobId = resolveRecoverableJobId(items, activeJobRecoveryPort);
    if (!jobId) {
      return;
    }
    navigationPort.recoverJob(jobId);
  }

  return {
    deleteJob,
    openJobReader,
    recoverActiveJob,
    selectJob,
  };
}
