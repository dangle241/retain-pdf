// Homepage fullscreen reading layer:iframe Load reader.htmlUninstall button missing on homepage.
// Close: Subpage postMessage → history.back → popstate Unload layer.

import { useEffect, useState } from "react";
import {
  SOFT_READER_CLOSE_MESSAGE,
  SOFT_READER_FORCE_CLOSE_EVENT,
  SOFT_READER_OPEN_EVENT,
  closeSoftReaderOnHost,
  isSoftReaderHistoryState,
} from "../../../../shared/navigation/soft-reader.js";

export function SoftReaderHost() {
  const [frame, setFrame] = useState<{ url: string; nonce: number } | null>(null);

  useEffect(() => {
    function openUrl(nextUrl: string, nonce = Date.now()) {
      const next = `${nextUrl || ""}`.trim();
      if (!next) return;
      // Force line break key Re-mount. iframe, to avoid same URL Reopen blank.
      setFrame({ url: next, nonce });
    }

    function onOpen(event: Event) {
      const detail = (event as CustomEvent)?.detail || {};
      const next = `${detail.url || ""}`.trim();
      const nonce = Number(detail.nonce) || Date.now();
      openUrl(next, nonce);
    }

    function onForceClose() {
      setFrame(null);
    }

    function onPopState() {
      if (isSoftReaderHistoryState(window.history.state) && window.history.state.readerUrl) {
        openUrl(window.history.state.readerUrl);
        return;
      }
      setFrame(null);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== SOFT_READER_CLOSE_MESSAGE) return;
      closeSoftReaderOnHost();
    }

    window.addEventListener(SOFT_READER_OPEN_EVENT, onOpen as EventListener);
    window.addEventListener(SOFT_READER_FORCE_CLOSE_EVENT, onForceClose);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("message", onMessage);

    // Forward/Restore on back
    onPopState();

    return () => {
      window.removeEventListener(SOFT_READER_OPEN_EVENT, onOpen as EventListener);
      window.removeEventListener(SOFT_READER_FORCE_CLOSE_EVENT, onForceClose);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-soft-reader-open", Boolean(frame));
    return () => {
      document.body.classList.remove("is-soft-reader-open");
    };
  }, [frame]);

  if (!frame) return null;

  return (
    <div
      id="soft-reader-host"
      className="soft-reader-host"
      role="dialog"
      aria-modal="true"
      aria-label="reader"
      data-soft-reader-url={frame.url}
    >
      <iframe
        id="soft-reader-frame"
        key={`${frame.nonce}:${frame.url}`}
        className="soft-reader-frame"
title="Reader"
        src={frame.url}
        // Allow same-origin scripts; reader in iframe Run internal. bundle
      />
    </div>
  );
}
