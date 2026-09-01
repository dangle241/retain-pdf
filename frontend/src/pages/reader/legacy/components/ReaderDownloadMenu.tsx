// 下载菜单(原始/对照/译文 PDF):旧 src/js/reader/download-actions.js 的 React 化。
// URL 解析/文件名/禁用原因全部复用纯逻辑(src/js/reader/downloads/resolve.js);
// 受保护下载与进度 toast 走 features/reader-dialog/downloads.js(与旧实现同一条链)。
// context 为 null(boot 未就绪)时三个按钮禁用——与旧页 sync() 前的初始 disabled 一致。

import { useRef, useState } from "react";
import {
  READER_DOWNLOAD_ACTIONS,
  disabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString,
} from "../../../../js/reader/downloads/resolve.js";
import { downloadProtectedResource } from "../../../../js/features/reader-dialog/downloads.js";
import { failDownloadToast } from "../../../../js/utils/download-feedback.js";
import { buildErrorDiagnostic } from "../../../../js/utils/error-diagnostics.js";

const ACTION_ORDER = ["source", "sideBySide", "translated"];

export function ReaderDownloadMenu({ context }) {
  const menuRef = useRef(null);
  const [busyAction, setBusyAction] = useState("");

  const urls = context
    ? resolveReaderDownloadUrls(context)
    : { source: "", sideBySide: "", translated: "" };

  async function handleDownload(action, url) {
    const descriptor = READER_DOWNLOAD_ACTIONS[action];
    if (!descriptor || !url || busyAction) {
      return;
    }
    // 点选后收起 popover(旧 closeMenu 语义)
    if (menuRef.current?.open) {
      menuRef.current.open = false;
    }
    try {
      const filename = resolveReaderDownloadName(action, context);
      await downloadProtectedResource(
        context.fetchProtected,
        url,
        filename,
        filename,
        null,
        (busy) => setBusyAction(busy ? action : ""),
      );
    } catch (err) {
      // 诊断信息进控制台(旧实现经 onStatus 外送,reader 页从未接收方);toast 面向用户
      console.error(buildErrorDiagnostic(err, {
        operation: descriptor.operation,
        url,
        jobId: context?.jobId || "",
      }));
      failDownloadToast(err.message || "下载失败");
    }
  }

  return (
    <details className="reader-download-menu" ref={menuRef}>
      <summary className="reader-topbar-action-btn reader-download-trigger" aria-label="下载 PDF">下载</summary>
      <div className="reader-download-popover">
        {ACTION_ORDER.map((action) => {
          const url = trimString(urls[action]);
          const enabled = Boolean(url) && busyAction !== action;
          return (
            <button
              key={action}
              id={`reader-download-${action}-btn`}
              type="button"
              className="reader-download-option"
              disabled={!enabled}
              aria-disabled={enabled ? "false" : "true"}
              title={enabled
                ? `下载${READER_DOWNLOAD_ACTIONS[action]?.label || "PDF"}`
                : disabledReason(action, urls)}
              data-busy={busyAction === action ? "1" : ""}
              onClick={() => void handleDownload(action, url)}
            >{READER_DOWNLOAD_ACTIONS[action].label}</button>
          );
        })}
      </div>
    </details>
  );
}
