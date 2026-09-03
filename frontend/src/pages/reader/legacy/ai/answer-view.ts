// Imperative rendering layer for AI bubble bodies: copied verbatim from legacy src/js/reader/ai/chat.js —
// streaming Markdown throttled render (~90ms), [n] citation buttons injected in place, citation footnote list,
// character typewriter animation, tool event text. React only renders the bubble skeleton (article/label/body);
// body content (Markdown DOM / citation buttons) does not go into the virtual DOM; everything is written
// via the message view handle.
//
// message view handle: { root, body } pointing to the React-committed bubble elements
// (root = article, body = .reader-ai-message-body-el), filled by component ref callbacks.

import { renderAiMarkdownFragment } from "../../../../js/reader/markdown-render.js";
import type { PageAnchor } from "../../../../js/reader/types.js";

// Semantic copy for agentic tool events (tool events from /api/v1/ai/ask)
// The frontend filters list_documents for the entire conversation; copy also avoids the "library" feel
const TOOL_EVENT_LABELS: Record<string, string> = {
  list_documents: "Confirm document information",
  read_blocks: "Read relevant paragraphs",
  search_favorites: "Search favorites",
  search_fulltext: "Search document content",
};

const PROGRESS_CLASS = "reader-ai-message-progress";

export interface AiCitation {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  title?: string;
  snippet?: string;
  [key: string]: unknown;
}

export interface AiToolEvent {
  tool?: string;
  round?: number;
  [key: string]: unknown;
}

export interface MessageView {
  root: HTMLElement | null;
  body: HTMLElement | null;
  attachRoot(element: HTMLElement | null): void;
  attachBody(element: HTMLElement | null): void;
}

export interface AiMessageEntry {
  id: string;
  role: string;
  title: string;
  view: MessageView;
}

export interface StreamMessageOptions {
  chunkSize?: number;
  intervalMs?: number;
}

export interface RenderRichAnswerOptions {
  jumpToCitation?: ((citation: AiCitation & PageAnchor) => void) | null;
}

function nowMs() {
  // Date.now() may not be available in some restricted environments; fall back to 0 (throttling degrades to per-call rendering, still correct)
  try {
    return Date.now();
  } catch (_err) {
    return 0;
  }
}

export function createMessageView(): MessageView {
  const view: MessageView = {
    root: null,
    body: null,
    attachRoot(element) {
      if (element) {
        view.root = element;
      }
    },
    attachBody(element) {
      if (element) {
        view.body = element;
      }
    },
  };
  return view;
}

export function isAgenticCitation(citation) {
  return !!citation
    && typeof citation === "object"
    && `${citation.block_id || ""}`.trim() !== "";
}

export function hasAgenticCitations(citations = []) {
  return Array.isArray(citations) && citations.some(isAgenticCitation);
}

export function formatCitations(citations = []) {
  if (!Array.isArray(citations) || !citations.length) {
    return "";
  }
  return `\n\ncitation: \n${citations
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item.title || "Relevant snippet"}${item.page ? ` · Page ${item.page} pages` : ""}${item.snippet ? `: ${item.snippet}` : ""}`)
    .join("\n")}`;
}

export function describeToolEvent(event: AiToolEvent = {}) {
  const tool = `${event?.tool || ""}`.trim();
  // Entire conversation: do not show "browsing library"-style progress
  if (tool === "list_documents") {
    return "";
  }
  const label = TOOL_EVENT_LABELS[tool] || tool;
  const action = label ? `Currently${label}...` : "Searching documents...";
  // No longer emphasizing "Page n round"; more like ordinary chat progress
  return action;
}

export function renderMessageText(view, text = "", citations = []) {
  if (!view?.body) {
    return;
  }
  view.body.textContent = `${text}${formatCitations(citations)}`;
}

export function setMessageProgress(view, on) {
  view?.root?.classList?.toggle?.(PROGRESS_CLASS, Boolean(on));
}

// Character typewriter animation (preserved old feel when no streaming answer and no agentic citations)
export function streamMessageText(view, text = "", citations = [], { chunkSize = 3, intervalMs = 12 }: StreamMessageOptions = {}) {
  if (!view?.body) {
    return Promise.resolve();
  }
  const fullText = `${text || ""}`;
  let index = 0;
  renderMessageText(view, "", []);
  return new Promise<void>((resolve) => {
    function tick() {
      index = Math.min(fullText.length, index + chunkSize);
      renderMessageText(view, fullText.slice(0, index), []);
      view.root?.parentElement?.scrollTo?.({ top: view.root.parentElement.scrollHeight });
      if (index >= fullText.length) {
        renderMessageText(view, fullText, citations);
        resolve();
        return;
      }
      globalThis.window?.setTimeout?.(tick, intervalMs) ?? setTimeout(tick, intervalMs);
    }
    tick();
  });
}

function clipSnippet(text = "", maxLength = 120) {
  const normalized = `${text}`.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function createCitationButton(documentRef, { className, text, citation, jumpToCitation }) {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener?.("click", () => {
    jumpToCitation?.(citation);
  });
  return button;
}

// Walk text nodes inside the container, replacing [n] markers in place with clickable citation buttons.
// Decoupled from Markdown rendering: whether the body is the DOM produced by marked or a plain-text
// fallback, citations can be added either way.
// Skip text inside code/pre ([n] inside code is not a citation).
function injectCitationButtons(container, citationByRef, documentRef, jumpToCitation) {
  if (!citationByRef.size || !container?.querySelectorAll) {
    return;
  }
  const walker = documentRef.createTreeWalker
    ? documentRef.createTreeWalker(container, 0x4 /* SHOW_TEXT */)
    : null;
  const textNodes = [];
  if (walker) {
    let node = walker.nextNode();
    while (node) {
      if (!node.parentElement?.closest?.("code, pre, .reader-ai-citation-ref")) {
        textNodes.push(node);
      }
      node = walker.nextNode();
    }
  }
  for (const textNode of textNodes) {
    const text = `${textNode.textContent || ""}`;
    if (!/\[\d+\]/.test(text)) {
      continue;
    }
    const fragment = documentRef.createDocumentFragment();
    for (const part of text.split(/(\[\d+\])/)) {
      if (!part) {
        continue;
      }
      const marker = part.match(/^\[(\d+)\]$/);
      const citation = marker ? citationByRef.get(marker[1]) : null;
      if (citation) {
        fragment.appendChild(createCitationButton(documentRef, {
          citation,
          className: "reader-ai-citation-ref",
          jumpToCitation,
          text: part,
        }));
      } else {
        fragment.appendChild(documentRef.createTextNode(part));
      }
    }
    textNode.replaceWith(fragment);
  }
}

// Render the answer text into the bubble: prefer Markdown (browser); if marked is not ready,
// fall back to plain text nodes.
// Then inject [n] citation buttons and the citation footnote list. Best-effort throughout;
// any step that fails degrades.
export async function renderRichAnswer(view, text = "", citations = [], { jumpToCitation = null }: RenderRichAnswerOptions = {}) {
  const body = view?.body;
  if (!body) {
    return;
  }
  const documentRef = view.root?.ownerDocument || body.ownerDocument || globalThis.document;
  const citationByRef = new Map();
  for (const citation of citations) {
    if (isAgenticCitation(citation)) {
      citationByRef.set(`${citation.ref}`, citation);
    }
  }

  // Non-agentic citations (title-style citations from local Markdown search) are kept as a trailing "Citations:" text block
  const plainCitationText = citationByRef.size ? "" : formatCitations(citations);

  // 1) Body: Markdown → fragment; on failure, plain text
  let rendered = false;
  if (typeof body.replaceChildren === "function" && documentRef.createElement) {
    try {
      const fragment = await renderAiMarkdownFragment(text, { documentRef });
      body.replaceChildren(fragment);
      if (plainCitationText && documentRef.createTextNode) {
        body.appendChild(documentRef.createTextNode(plainCitationText));
      }
      rendered = true;
    } catch (_err) {
      rendered = false;
    }
  }
  if (!rendered) {
    body.textContent = `${text}${plainCitationText}`;
  }

  // 2) Inject [n] citation buttons in place (decoupled from marked)
  injectCitationButtons(body, citationByRef, documentRef, jumpToCitation);

  // 3) Citation footnote list (attached to the bubble article, sibling to the body)
  const messageEl = view.root;
  if (!citationByRef.size || typeof messageEl?.appendChild !== "function") {
    return;
  }
  messageEl.querySelector?.(".reader-ai-citations")?.remove?.();
  const footer = documentRef.createElement("div");
  footer.className = "reader-ai-citations";
  for (const citation of citationByRef.values()) {
    const pageIdx = Number(citation.page_idx);
    const pageLabel = Number.isFinite(pageIdx) && pageIdx >= 0 ? ` · Page ${pageIdx + 1} pages` : "";
    footer.appendChild(createCitationButton(documentRef, {
      citation,
      className: "reader-ai-citation-item",
      jumpToCitation,
      text: `[${citation.ref}] ${clipSnippet(citation.snippet || "Relevant snippet")}${pageLabel}`,
    }));
  }
  messageEl.appendChild(footer);
}

// Streaming Markdown incremental rendering: throttled by time (~90ms) to avoid per-token re-parse stalls.
// Returns { push(fullText), stop() }: push queues the latest accumulated text, stop cancels any
// pending throttled render (call before finalize to avoid late triggers overwriting citation buttons).
export function createStreamingMarkdownRenderer(view, throttleMs = 90) {
  let latest = "";
  let rendering = false;
  let dirty = false;
  let lastAt = 0;
  let timer = null;

  async function doRender() {
    if (rendering) {
      dirty = true;
      return;
    }
    rendering = true;
    dirty = false;
    lastAt = nowMs();
    const text = latest;
    // During streaming only render the body Markdown; citation buttons / footnotes wait until finalize
    await renderRichAnswer(view, text, [], {});
    rendering = false;
    if (dirty) {
      await doRender();
    }
  }

  function schedule() {
    if (timer) {
      return;
    }
    const wait = Math.max(0, throttleMs - (nowMs() - lastAt));
    timer = (globalThis.setTimeout || setTimeout)(() => {
      timer = null;
      void doRender();
    }, wait);
  }

  return {
    push(fullText) {
      latest = `${fullText || ""}`;
      schedule();
    },
    stop() {
      if (timer) {
        (globalThis.clearTimeout || clearTimeout)(timer);
        timer = null;
      }
      dirty = false;
    },
  };
}




