// Reader"返回主pages"
//
// 1) 软打开(主pages SoftReaderHost iframe)→ postMessage 父pages history.back, 主pages不刷新
// 2) 独立 reader.html 且从主pages assign 进来 → history.back
// 3) 深链直达 → location.assign(index.html)

import { X } from "lucide-react";
import { peekHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { SOFT_READER_CLOSE_MESSAGE } from "../../../../shared/navigation/soft-reader.js";

function homeIndexUrl() {
  return new URL("./index.html", window.location.href).href;
}

function requestSoftHostClose(): boolean {
  if (typeof window === "undefined") return false;
  if (window.self === window.top) return false;
  try {
    window.parent.postMessage(
      { type: SOFT_READER_CLOSE_MESSAGE },
      window.location.origin,
    );
    return true;
  } catch {
    return false;
  }
}

/** 从阅读pages回主pages */
export function navigateReaderToHome() {
  if (typeof window === "undefined") return;

  // 软阅读层: 让父pages卸层, 绝不在 iframe 里 assign 主pages
  if (requestSoftHostClose()) {
    return;
  }

  const saved = peekHomeReturnState();
  if (saved?.allowBack && window.history.length > 1) {
    window.history.back();
    return;
  }

  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (
      ref
      && ref.origin === window.location.origin
      && !/reader\.html/i.test(ref.pathname)
      && window.history.length > 1
    ) {
      window.history.back();
      return;
    }
  } catch {
    /* ignore */
  }

  window.location.assign(homeIndexUrl());
}

export function ReaderCloseHome() {
  return (
    <button
      id="reader-close-home-btn"
      type="button"
      className="reader-close-home-btn"
      aria-label="返回主pages"
      title="返回主pages"
      onClick={navigateReaderToHome}
    >
      <X className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
      <span className="reader-close-home-label">Close</span>
    </button>
  );
}



