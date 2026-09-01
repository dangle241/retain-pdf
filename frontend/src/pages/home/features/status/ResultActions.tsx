onClick: () => void;
};
//
/
// 3b Rendered bare only <a href="reader.html?...">,Click interception missing.——Full-page redirect will
* statusCardStore.snapshot complete shape.
* Source field EMPTY default value + buildJobStatusViewModel + summary merged.
// JS Fallback available on invalidation.
//
/
export type StatusCardSnapshot = {
jobId: string;
// Handler runs before native. <a> Default redirect executes. event.preventDefault()——Button itself does not
// Extra connection needed. onClick(Delegate click. Button renderer irrelevant.)Subscribe only here
status: string;
label: string;
// override back to original label)。

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
value: string;
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
      <ActionLink id={STATUS_CARD_ACTION_IDS.markdownBundle} label="下载 Markdown" ready={markdownBundleReady} url={markdownBundleUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.sourcePdf} label="下载原始 PDF" ready={sourcePdfReady} url={sourcePdfUrl} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.reader} label="对照阅读" ready={readerReady} url={readerUrl} onClick={onReaderClick} />
      <ActionLink id={STATUS_CARD_ACTION_IDS.pdf} label="下载 PDF" ready={pdfReady} url={pdfUrl} />
    </div>
  );
}
