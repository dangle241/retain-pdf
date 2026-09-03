// Result action row (blueprint §2 features/status/; mirrors
// job-status-card-rendering.js syncPrimaryActions/setActionLinkState — DOM
// contract preserved by id/class).
//
// "Side-by-side Reader" link (dialogs blueprint §4 scope page 6 entry ①):
// runtime verification confirmed it only renders a bare <a href="reader.html?...">,
// with no click interception — full-page navigation would interrupt the SPA dialog
// experience. Added onClick (preventDefault + onReaderClick) to route through
// ReaderDialog's unified openReaderRequested entry; href is kept as a fallback
// for when JS is disabled.
//
// markdownBundle/sourcePdf/pdf three download links (dialogs blueprint §7):
// these ids hit the artifact-downloads domain's document-level delegated click
// (controller.js handleProtectedArtifactClick, mounted via bindEvents() in
// composition.js; that handler runs event.preventDefault() before the native <a>
// default navigation — the button itself does not need to attach onClick (delegated
// click is independent of which component Rendering the button). Here we only
// subscribe to the corresponding actionId slice of artifact-download-busy-store.js
// to drive the "Downloading..." label and disabled state (approach 2: avoids the
// parent component's polling re-renders overwriting the imperative download progress
// text with the original label).

import { useHomeServices } from "../../home-services-context.js";
import { useArtifactDownloadBusy } from "../../state/use-artifact-download-busy.js";
import { STATUS_CARD_ACTION_IDS } from "./status-card-dom-ids.js";

type ActionLinkProps = {
  id: string;
  label: string;
  ready: boolean;
  url: string;
  onClick?: () => void;
};

function ActionLink({ id, label, ready, url, onClick }: ActionLinkProps) {
  const services = useHomeServices();
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, id);
  const enabled = Boolean(ready && url) && !busyState.busy;
  const isReaderLink = id === STATUS_CARD_ACTION_IDS.reader;
  const displayLabel = busyState.busy ? (busyState.label || "Downloading...") : label;
  return (
    <a
      id={id}
      className={`status-action-btn task-toolbar-btn-result${ready ? "" : " hidden"}${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target={isReaderLink ? undefined : "_blank"}
      rel={isReaderLink ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
      onClick={isReaderLink && onClick
        ? (event) => {
          if (!enabled) {
            return;
          }
          event.preventDefault();
          onClick();
        }
        : undefined}
    >
      <span>{displayLabel}</span>
    </a>
  );
}

type ResultActionsProps = {
  markdownBundleReady?: boolean;
  markdownBundleUrl?: string;
  sourcePdfReady?: boolean;
  sourcePdfUrl?: string;
  readerReady?: boolean;
  readerUrl?: string;
  pdfReady?: boolean;
  pdfUrl?: string;
  onReaderClick?: () => void;
};

export function ResultActions({
  markdownBundleReady = false,
  markdownBundleUrl = "",
  sourcePdfReady = false,
  sourcePdfUrl = "",
  readerReady = false,
  readerUrl = "",
  pdfReady = false,
  pdfUrl = "",
  onReaderClick,
}: ResultActionsProps) {
  const hasActions = markdownBundleReady || pdfReady || readerReady || sourcePdfReady;

  return (
    <div className={`status-result-actions${hasActions ? "" : " hidden"}`}>
      <ActionLink id={STATUS_CARD_ACTION_IDS.markdownBundle} label="Download Markdown" ready={markdownBundleReady} url={markdownBundleUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.sourcePdf} label="Download source PDF" ready={sourcePdfReady} url={sourcePdfUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.reader} label="Side-by-side Reader" ready={readerReady} url={readerUrl} onClick={onReaderClick} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.pdf} label="Download PDF" ready={pdfReady} url={pdfUrl} />
    </div>
  );
}


