// StatusCard entry point: main workflow / Book Details two display variants split into separate files.
//
// - StatusCardMain: workflow dialog #job-status-card (DOM contract / smoke)
// - StatusCardEmbedded: details #book-detail-job-status-card (bd-job-status-* fixed height)
// - useStatusCardModel: shared store → display / lottie / progress

import { StatusCardMain } from "./StatusCardMain.jsx";
import { StatusCardEmbedded } from "./StatusCardEmbedded.jsx";

/**
 * @param {object} props
 * @param {boolean} [props.visible]
 * @param {boolean} [props.embedded]
 * @param {string} [props.idPrefix]
 * @param {boolean} [props.showResultActions]
 * @param {boolean} [props.showHiddenContract]
 * @param {string} [props.rootId]
 * @param {string} [props.className]
 * @param {object} [props.fallbackItem]
 */
export function StatusCard({
  visible = true,
  embedded = false,
  idPrefix = "book-detail-",
  showResultActions,
  showHiddenContract,
  rootId,
  className = "",
  fallbackItem = null,
}) {
  if (embedded) {
    return (
      <StatusCardEmbedded
        visible={visible}
        idPrefix={idPrefix}
        rootId={rootId || `${idPrefix}job-status-card`}
        className={className}
        fallbackItem={fallbackItem}
      />
    );
  }

  return (
    <StatusCardMain
      visible={visible}
      showResultActions={showResultActions ?? true}
      showHiddenContract={showHiddenContract ?? true}
      className={className}
    />
  );
}

export { StatusCardMain } from "./StatusCardMain.jsx";
export { StatusCardEmbedded } from "./StatusCardEmbedded.jsx";
export { useStatusCardModel } from "./use-status-card-model.js";
export { mergeSnapshotWithFallback, isPollingBootstrapPlaceholder } from "./merge-snapshot-with-fallback.js";


