export const READER_PROGRESS_COPY = Object.freeze({
  boot: "Preparing side-by-side reader...",
  metadata: "Loading job information...",
  both: "Loading source and translated PDFs...",
  sourceOnly: "Source PDF loaded. Loading translated PDF...",
  translatedOnly: "Translated PDF loaded. Loading source PDF...",
  ready: "Side-by-side Readeris ready",
  failed: "Side-by-side Readerfailed to load",
});

export function createReaderPageState() {
  return {
    reader: {
      totalPages: 0,
      currentPage: 0,
      primaryViewerKey: "",
    },
    progress: {
      metadataReady: false,
      sourceDone: false,
      translatedDone: false,
    },
    bootProgressBar: {
      value: 0,
      target: 0,
      rafId: 0,
    },
  };
}

export function resetReaderProgressState(state) {
  if (!state?.progress) {
    return;
  }
  state.progress.metadataReady = false;
  state.progress.sourceDone = false;
  state.progress.translatedDone = false;
}

export function computeReaderProgressSnapshot(
  progressState,
  copy = READER_PROGRESS_COPY,
) {
  if (!progressState?.metadataReady) {
    return { percent: 8, text: copy.boot, stage: "boot" };
  }
  const completedPdfs = Number(progressState.sourceDone) + Number(progressState.translatedDone);
  const percent = 24 + completedPdfs * 30;
  if (completedPdfs === 0) {
    return { percent, text: copy.both, stage: "pdfs" };
  }
  if (completedPdfs === 1) {
    return {
      percent,
      text: progressState.sourceDone ? copy.sourceOnly : copy.translatedOnly,
      stage: "pdfs",
    };
  }
  return { percent: 92, text: copy.ready, stage: "readying" };
}




