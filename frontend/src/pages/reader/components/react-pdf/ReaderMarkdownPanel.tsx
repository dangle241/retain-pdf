// Markdown Hover preview: task recognition/translation Markdown output

import { useEffect, useRef, useState, type RefObject } from "react";
import { FileCode2 } from "lucide-react";
import {
  defaultReaderDataPort,
  fetchProtected,
  parseMarkdownWithMath,
  resolveMarkdownAssetUrl,
  resolveMarkedVendorUrl,
} from "../../external.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";

export type ReaderMarkdownPanelProps = {
  open: boolean;
  jobId: string;
  sourceOnly: boolean;
  onClose: () => void;
};

let markedModulePromise: Promise<{ marked: { parse: (src: string, opts?: { async: boolean }) => string } }> | null = null;

function loadMarked() {
  if (!markedModulePromise) {
    markedModulePromise = import(/* @vite-ignore */ resolveMarkedVendorUrl()).catch((err) => {
      markedModulePromise = null;
      throw err;
    }) as typeof markedModulePromise;
  }
  return markedModulePromise!;
}

function sanitizeRenderedMarkdown(container: ParentNode) {
  container.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
  container.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...(node as Element).attributes]) {
      if (/^on/i.test(attribute.name)) {
        (node as Element).removeAttribute(attribute.name);
      }
    }
  });
  container.querySelectorAll("a[href]").forEach((anchor) => {
    const el = anchor as HTMLAnchorElement;
    if (/^\s*javascript:/i.test(el.getAttribute("href") || "")) {
      el.removeAttribute("href");
    }
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  });
}

export function ReaderMarkdownPanel({
  open,
  jobId,
  sourceOnly,
  onClose,
}: ReaderMarkdownPanelProps) {
  const contentRef = useRef<HTMLElement | null>(null);
const [status, setStatus] = useState("Not loaded");
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      if (sourceOnly || !jobId) {
setStatus("source document reading does not provide Markdown output");
        if (contentRef.current) {
          contentRef.current.replaceChildren();
          contentRef.current.classList.add("hidden");
        }
        return;
      }
setStatus("Loading Markdown...");
      try {
        const payload = await defaultReaderDataPort.loadMarkdownPayload(jobId);
        if (cancelled) return;
        const content = `${payload?.content_with_absolute_image_urls || payload?.content || ""}`;
        const imagesBaseUrl = `${payload?.images_base_url || payload?.images_base_path || ""}`.trim();
        if (!content.trim()) {
setStatus("No Markdown output for this task");
          contentRef.current?.replaceChildren();
          contentRef.current?.classList.add("hidden");
          return;
        }
        const { marked } = await loadMarked();
        if (cancelled || !contentRef.current) return;
        const html = await parseMarkdownWithMath(content, (src) =>
          String(marked.parse(src, { async: false })),
        );
        if (cancelled || !contentRef.current) return;
        const template = contentRef.current.ownerDocument.createElement("template");
        template.innerHTML = html;
        sanitizeRenderedMarkdown(template.content);
        template.content.querySelectorAll("img[src]").forEach((img) => {
// Resolve relative images/... to API absolute path using base; prevent mount failure. reader.html same-origin 404
          const raw = img.getAttribute("src") || "";
          const resolved = resolveMarkdownAssetUrl(imagesBaseUrl, raw) || raw;
          img.setAttribute("data-reader-md-src", resolved);
          img.removeAttribute("src");
        });
        contentRef.current.replaceChildren(template.content);
        contentRef.current.classList.remove("hidden");
        setStatus("");

// Protected image â fetch blob with X-API-Key (<img> cannot carry auth header)
        const images = [...contentRef.current.querySelectorAll("img[data-reader-md-src]")];
        let failed = 0;
        await Promise.allSettled(images.map(async (img) => {
          const src = img.getAttribute("data-reader-md-src") || "";
          try {
            const response = await fetchProtected(src);
            if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
            const objectUrl = URL.createObjectURL(await response.blob());
            objectUrlsRef.current.push(objectUrl);
            (img as HTMLImageElement).src = objectUrl;
          } catch {
            failed += 1;
            const fallback = img.ownerDocument.createElement("span");
            fallback.className = "reader-markdown-image-missing";
fallback.textContent = `[Image unavailable]`;
            fallback.title = src;
            img.replaceWith(fallback);
          }
        }));
        if (!cancelled && failed > 0 && failed === images.length && images.length > 0) {
          setStatus(`Image failed to load.${failed} images). Please confirm API Reachable & Configured X-API-Key。`);
        }
      } catch (err) {
        if (cancelled) return;
setStatus(err instanceof Error ? err.message : "Markdown load failed");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, jobId, sourceOnly]);

  return (
    <ReaderFloatShell
      id="reader-markdown-panel"
      open={open}
      title="Markdown"
      subtitle="recognition and translation output · Drag to move"
      titleIcon={<FileCode2 size={14} strokeWidth={2.25} aria-hidden />}
      storageKey="retainpdf.reader.markdown-float.pos.v1"
      ariaLabel="Markdown preview"
      width={420}
      onClose={onClose}
      toolbar={(
        <span className="reader-notes-count">{status || "已加载"}</span>
      )}
    >
      {status && !contentRef.current?.childNodes?.length ? (
        <p className="reader-notes-empty">{status}</p>
      ) : null}
      <article
        ref={contentRef as RefObject<HTMLElement>}
        id="reader-markdown-content"
        className="reader-markdown-content reader-float-markdown-content"
      />
    </ReaderFloatShell>
  );
}
