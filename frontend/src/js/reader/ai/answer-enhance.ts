// Tăng cường DOM câu trả lời AI: chèn trích dẫn [n] có thể bấm, rút gọn chú thích chân trang, chuyển ảnh xác thực thành blob.

import { fetchProtected } from "../../api/http.js";
import { resolveResourceUrl } from "../../job/artifacts.js";
import {
  isReaderAiNavigationLocked,
  shouldIgnoreReaderAiNavEvent,
} from "./ui-interaction-lock.js";

export type AiCitationLike = {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  job_id?: string;
  document_id?: string;
  snippet?: string;
  [key: string]: unknown;
};

export function isAgenticCitation(citation: unknown): citation is AiCitationLike {
  return !!citation
    && typeof citation === "object"
    && `${(citation as AiCitationLike).block_id || ""}`.trim() !== "";
}

/** Phân tích page_idx gốc 0 từ citation; nếu thiếu, thử p00N trong block_id. */
export function resolveCitationPageIdx(citation: AiCitationLike | null | undefined): number | null {
  if (!citation || typeof citation !== "object") return null;
  // page_idx dùng gốc 0 toàn luồng (Python Citation/luồng ask mới).
  const rawIdx = citation.page_idx;
  if (rawIdx !== undefined && rawIdx !== null && `${rawIdx}`.trim() !== "") {
    const n = Number(rawIdx);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  // Trường page trong hệ thống đều gốc 1 (luồng /reader/ai/chat cũ, Python _public_anchor)
  // ; trước đây bị dùng trực tiếp như gốc 0 nên dữ liệu chỉ có page lệch một trang (kiểm toán B4, lỗi off-by-one tiềm ẩn).
  const rawPage = citation.page;
  if (rawPage !== undefined && rawPage !== null && `${rawPage}`.trim() !== "") {
    const n = Number(rawPage);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n) - 1;
  }
  // p009-b0010 → page 9 (1-based) → idx 8
  const match = `${citation.block_id || ""}`.match(/(?:^|[^0-9])p0*([1-9]\d*)(?:-|_|\b)/i);
  if (match) {
    const oneBased = Number(match[1]);
    if (Number.isFinite(oneBased) && oneBased >= 1) return oneBased - 1;
  }
  return null;
}

/** Số trang gốc 1 của trình đọc. */
export function resolveCitationPageNumber(citation: AiCitationLike | null | undefined): number | null {
  const idx = resolveCitationPageIdx(citation);
  if (idx === null) return null;
  return idx + 1;
}

export function clipSnippet(text = "", maxLength = 72): string {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

/** Chỉ giữ [n] xuất hiện trong nội dung trả lời để tránh đổ ra danh sách dài 10 mục. */
export function pickCitationsForAnswer(
  answerText: string,
  citations: AiCitationLike[],
  { max = 5 }: { max?: number } = {},
): AiCitationLike[] {
  const agentic = citations.filter(isAgenticCitation).map((c) => ({
    ...c,
    page_idx: resolveCitationPageIdx(c) ?? c.page_idx,
  }));
  if (!agentic.length) return [];

  const byRef = new Map<string, AiCitationLike>();
  for (const c of agentic) {
    byRef.set(`${c.ref}`, c);
  }

  const orderedRefs: string[] = [];
  const seen = new Set<string>();
  for (const match of `${answerText || ""}`.matchAll(/\[(\d+)\]/g)) {
    const ref = match[1];
    if (seen.has(ref)) continue;
    if (!byRef.has(ref)) continue;
    seen.add(ref);
    orderedRefs.push(ref);
  }

  if (orderedRefs.length) {
    return orderedRefs.slice(0, max).map((ref) => byRef.get(ref)!);
  }

  // Khi nội dung không đánh dấu [n], chỉ giữ một số điểm neo chất lượng cao và loại trùng theo trang.
  const fallback: AiCitationLike[] = [];
  const pages = new Set<number>();
  for (const c of agentic) {
    const page = resolveCitationPageIdx(c);
    if (page !== null) {
      if (pages.has(page)) continue;
      pages.add(page);
    }
    fallback.push(c);
    if (fallback.length >= Math.min(3, max)) break;
  }
  return fallback;
}

export function buildPagePreviewUrl(jobId: string, pageIdx0: number, kind: "translated" | "source" = "translated"): string {
  const job = `${jobId || ""}`.trim();
  const page = Math.max(1, Math.floor(Number(pageIdx0) || 0) + 1);
  if (!job) return "";
  const path = `/api/v1/jobs/${encodeURIComponent(job)}/preview/pages/${page}?kind=${kind}&width=240`;
  return resolveResourceUrl(path) || path;
}

export function buildMarkdownImageApiUrl(jobId: string, relativePath: string): string {
  const job = `${jobId || ""}`.trim();
  let rel = `${relativePath || ""}`.replace(/\\/g, "/").replace(/^\.\//, "");
  while (rel.startsWith("images/")) {
    rel = rel.slice("images/".length);
  }
  if (!job || !rel) return "";
  const path = `/api/v1/jobs/${encodeURIComponent(job)}/markdown/images/${rel.split("/").map(encodeURIComponent).join("/")}`;
  return resolveResourceUrl(path) || path;
}

/**
 * Đổi <a href> do markdown tạo thành span không điều hướng.
 * Trên Electron desktop, setWindowOpenHandler → shell.openExternal:
 * Mọi target=_blank / window.open / lần bấm <a> thật đều mở trình duyệt hệ thống.
 * Vì vậy lần bấm ngoài ý muốn khi remount nhánh bị cảm nhận như "mở lại tab mới".
 */
export function neutralizeMarkdownAnchors(
  container: ParentNode,
  {
    onOpen,
    documentRef = globalThis.document,
  }: {
    /** Callback khi người dùng chủ động bấm liên kết; trả true nghĩa là đã xử lý. */
    onOpen?: ((href: string, event: MouseEvent) => boolean | void) | null;
    documentRef?: Document;
  } = {},
): void {
  if (!container || !documentRef) return;
  const anchors = [...((container as Element).querySelectorAll?.("a[href]") || [])];
  for (const anchor of anchors) {
    const a = anchor as HTMLAnchorElement;
    const href = `${a.getAttribute("href") || ""}`.trim();
    const span = documentRef.createElement("span");
    span.className = `aui-md-extlink${a.className ? ` ${a.className}` : ""}`.trim();
    // Giữ nút con vì liên kết có thể chứa strong/code.
    while (a.firstChild) {
      span.appendChild(a.firstChild);
    }
    if (!span.textContent?.trim() && href) {
      span.textContent = href;
    }

    if (
      href
      && !href.startsWith("#")
      && !/^\s*javascript:/i.test(href)
    ) {
      span.dataset.href = href;
      span.setAttribute("role", "link");
      span.tabIndex = 0;
      span.title = `Mở liên kết: ${href}`;
      const tryOpen = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        if (shouldIgnoreReaderAiNavEvent(event)) return;
        if (isReaderAiNavigationLocked()) return;
        if (event instanceof MouseEvent) {
          // Chỉ chấp nhận lần bấm đáng tin trên nút chính có số lần bấm thật.
          if (event.button !== 0) return;
          if (event.detail === 0) return;
        }
        if (onOpen?.(href, event as MouseEvent) === true) return;
        // Mặc định: không tự openExternal. Khi cần cử chỉ rõ ràng của người dùng, onOpen xử lý.
        // Tại đây chỉ no-op để tránh việc bấm nhánh lại bật trình duyệt.
      };
      span.addEventListener("click", tryOpen);
      span.addEventListener("auxclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      span.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        tryOpen(event);
      });
    } else {
      // Điểm neo/liên kết rỗng: văn bản thuần.
      span.removeAttribute("role");
    }
    a.replaceWith(span);
  }

  // Bảo vệ kép: nếu vẫn còn a[href] được chèn động, chặn mọi điều hướng ở pha capture.
  const host = container as HTMLElement;
  if (host instanceof HTMLElement && !host.dataset.auiLinkGuard) {
    host.dataset.auiLinkGuard = "1";
    host.addEventListener(
      "click",
      (event) => {
        const t = event.target;
        if (!(t instanceof Element)) return;
        const a = t.closest("a[href]");
        if (!a || !host.contains(a)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }
}

/** Đổi [n] trong nội dung thành nút có thể bấm (bỏ qua code/pre). */
export function injectCitationMarkers(
  container: ParentNode,
  citationByRef: Map<string, AiCitationLike>,
  onJump: ((citation: AiCitationLike) => void) | null,
  documentRef: Document = globalThis.document,
): void {
  if (!citationByRef.size || !container) return;
  // Xóa đánh dấu cũ trước để tránh injection lặp chồng nhiều listener.
  (container as Element).querySelectorAll?.("button.reader-ai-citation-ref").forEach((btn) => {
    const parent = btn.parentNode;
    if (!parent) return;
    parent.replaceChild(documentRef.createTextNode(btn.textContent || ""), btn);
    parent.normalize?.();
  });
  // 0x4 = SHOW_TEXT; tránh phụ thuộc NodeFilter toàn cục vì jsdom/một số môi trường không gắn nó.
  const walker = documentRef.createTreeWalker?.(container as Node, 0x4) || null;
  const textNodes: Text[] = [];
  if (walker) {
    let node = walker.nextNode();
    while (node) {
      if (!(node.parentElement?.closest?.("code, pre, .reader-ai-citation-ref, button, a, .aui-msg-actions"))) {
        textNodes.push(node as Text);
      }
      node = walker.nextNode();
    }
  }
  for (const textNode of textNodes) {
    const text = `${textNode.textContent || ""}`;
    if (!/\[\d+\]/.test(text)) continue;
    const fragment = documentRef.createDocumentFragment();
    for (const part of text.split(/(\[\d+\])/)) {
      if (!part) continue;
      const marker = part.match(/^\[(\d+)\]$/);
      const citation = marker ? citationByRef.get(marker[1]) : null;
      if (citation) {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "reader-ai-citation-ref";
        button.textContent = part;
        const pageNo = resolveCitationPageNumber(citation);
        button.title = pageNo
          ? `Đi đến trang ${pageNo} · ${clipSnippet(citation.snippet || "", 60)}`
          : clipSnippet(citation.snippet || "Đoạn liên quan", 60);
        if (pageNo != null) button.dataset.page = `${pageNo}`;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          // Lần bấm ngoài ý muốn khi remount nhánh/chuyển hội thoại không làm chuyển trang.
          if (shouldIgnoreReaderAiNavEvent(event)) return;
          onJump?.(citation);
        });
        fragment.appendChild(button);
      } else {
        fragment.appendChild(documentRef.createTextNode(part));
      }
    }
    textNode.replaceWith(fragment);
  }
}

/** Thu hồi blob URL đã hydrate trong container trước khi kết xuất lại/gỡ để tránh rò rỉ (kiểm toán P1-5). */
export function revokeHydratedImageUrls(container: ParentNode | null | undefined): void {
  if (!container) return;
  const images = [...((container as Element).querySelectorAll?.("img.is-hydrated") || [])];
  for (const img of images) {
    const src = (img as HTMLImageElement).src || "";
    if (src.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(src);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Ảnh API được bảo vệ → blob (ảnh markdown trong nội dung trả lời). */
export async function hydrateProtectedImages(
  container: ParentNode,
  { fetchImpl = fetchProtected }: { fetchImpl?: typeof fetchProtected } = {},
): Promise<void> {
  const images = [...(container as Element).querySelectorAll?.("img[src], img[data-ai-src]") || []];
  await Promise.allSettled(images.map(async (img) => {
    const el = img as HTMLImageElement;
    const raw = el.getAttribute("data-ai-src") || el.getAttribute("src") || "";
    if (!raw || raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("mock:")) {
      return;
    }
    const isApi = /\/api\/v1\//i.test(raw) || raw.startsWith("/") || !/^[a-z]+:/i.test(raw);
    if (!isApi) return;
    const url = resolveResourceUrl(raw) || raw;
    el.setAttribute("data-ai-src", url);
    try {
      const response = await fetchImpl(url);
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
      const objectUrl = URL.createObjectURL(await response.blob());
      // Thu hồi blob cũ khi hydrate lại cùng img do trích dẫn/nội dung thay đổi và kết xuất lại.
      const previous = el.src || "";
      if (previous.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previous);
        } catch {
          /* ignore */
        }
      }
      el.src = objectUrl;
      el.classList.add("is-hydrated");
    } catch {
      el.classList.add("is-missing");
      el.alt = el.alt || "Ảnh tạm thời không khả dụng";
    }
  }));
}

/**
 * Rút gọn chú thích trích dẫn: chip nhỏ gọn, mặc định không trải ảnh thu nhỏ lớn.
 * Chỉ hiển thị các mục sau khi chọn (thường là [n] trong nội dung).
 */
export function renderCitationFooter(
  host: HTMLElement,
  citations: AiCitationLike[],
  {
    onJump = null,
    answerText = "",
    max = 5,
    documentRef = globalThis.document,
  }: {
    onJump?: ((citation: AiCitationLike) => void) | null;
    answerText?: string;
    max?: number;
    documentRef?: Document;
  } = {},
): void {
  host.querySelector(".reader-ai-citations")?.remove();
  const picked = pickCitationsForAnswer(answerText, citations, { max });
  if (!picked.length) return;

  const footer = documentRef.createElement("div");
  footer.className = "reader-ai-citations";
  footer.setAttribute("aria-label", "Nguồn trích dẫn");

  const head = documentRef.createElement("div");
  head.className = "reader-ai-citations-head";
  head.textContent = "Nguồn";
  footer.appendChild(head);

  const list = documentRef.createElement("div");
  list.className = "reader-ai-citations-list";

  for (const citation of picked) {
    const pageNo = resolveCitationPageNumber(citation);
    const pageLabel = pageNo != null ? `p.${pageNo}` : "";
    const row = documentRef.createElement("button");
    row.type = "button";
    row.className = "reader-ai-citation-item";
    if (pageNo != null) row.dataset.page = `${pageNo}`;
    row.title = pageNo != null ? `Đi đến trang ${pageNo}` : "Định vị nguồn";
    row.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (shouldIgnoreReaderAiNavEvent(event)) return;
      onJump?.(citation);
    });

    const refEl = documentRef.createElement("span");
    refEl.className = "reader-ai-citation-refno";
    refEl.textContent = `[${citation.ref ?? "?"}]`;

    const meta = documentRef.createElement("span");
    meta.className = "reader-ai-citation-meta";
    meta.textContent = pageLabel || "—";

    const copy = documentRef.createElement("span");
    copy.className = "reader-ai-citation-copy";
    copy.textContent = clipSnippet(citation.snippet || "Đoạn liên quan", 64);

    row.append(refEl, meta, copy);
    list.appendChild(row);
  }

  footer.appendChild(list);
  host.appendChild(footer);
}
