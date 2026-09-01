// 结果Action行(蓝图 §2 features/status/;镜像 job-status-card-rendering.js 的
// syncPrimaryActions/setActionLinkState——DOM 契约逐 id/class 保留).
//
// "Side-by-side Reader"链接(dialogs 蓝图 §4 施工ScopePage 6 entries ①):运行时复核确认
// 3b 只Rendering了裸 <a href="reader.html?...">,没有拦截点击——整pages跳转会
// 打断 SPA 的对话框体验,补上 onClick(preventDefault + onReaderClick)
// 走 ReaderDialog 统一的 openReaderRequested 入口,href 保留作为
// JS 失效时的Ready兜底.
//
// markdownBundle/sourcePdf/pdf 三个下载链接(dialogs 蓝图 §7):这几个 id
// 命中 artifact-downloads 域的 document 级委托点击(controller.js 的
// handleProtectedArtifactClick,composition.js 已挂载 bindEvents()),点击
// 时该处理器会先于原生 <a> 默认跳转执行 event.preventDefault()——按钮books身不
// required额外接 onClick(委托点击与谁Rendering了按钮None关).这里只订阅
// artifact-download-busy-store.js 的对应 actionId m片,驱动"Downloading...".
// 文案与禁用态(方案二:避免父组件因轮询重Rendering把命令式写入的下载Progress文案
// 覆盖回原始 label).

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




