import { APP_EVENTS } from "../../contracts/app-contract.js";
import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";

export function createRecentJobsNavigationPort({
  closeDialog,
  currentJobId = () => "",
  doc = document,
  jobRuntimePort = createRecentJobsRuntimePort({ currentJobId }),
  readerPort = createRecentJobsReaderPort(),
  /** Library grid defaults to false: progress is in Book Detail tab, does not open legacy workflow dialog */
  openWorkflowOnSelect = false,
}: any = {}) {
  function openWorkflow() {
    doc?.dispatchEvent?.(new CustomEvent(APP_EVENTS.openTranslationWorkflow));
  }

  return {
    currentJobId() {
      return `${jobRuntimePort.currentJobId?.() || currentJobId?.() || ""}`.trim();
    },

    openJob(jobId) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      closeDialog?.();
      if (openWorkflowOnSelect) {
        openWorkflow();
      }
      return jobRuntimePort.openJob?.(normalizedJobId) !== false;
    },

    openReader(jobId) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      closeDialog?.();
      return readerPort.openReader?.(normalizedJobId) !== false;
    },

    recoverJob(jobId) {
      const normalizedJobId = `${jobId || ""}`.trim();
      if (!normalizedJobId) {
        return false;
      }
      // Prioritize recoverJob (silent poll); compat with legacy port providing openJob only
      if (typeof jobRuntimePort.recoverJob === "function") {
        return jobRuntimePort.recoverJob(normalizedJobId) !== false;
      }
      return jobRuntimePort.openJob?.(normalizedJobId) !== false;
    },
  };
}


