// AI Imperative rendering layer for bubble body:From old src/js/reader/ai/chat.js Port semantics verbatim.——
// Streaming Markdown: Throttle rendering (~90ms), [n] Inject quote button inline; append footnote list.
// Character typewriter animationtool Event copy.React Render only bubble skeleton.(article/label/body),
// Body content(Markdown DOM/Quote button)Do not enter virtual. DOM,All via message view Write handle.
//
// message view Handle: { root, body } points to React submitted bubble element
// (root=article,body=.reader-ai-message-body-el),By component ref Populate callback.

import { renderAiMarkdownFragment } from "../../../../js/reader/markdown-render.js";
import type { PageAnchor } from "../../../../js/reader/types.js";

// Agentic semantic copy for tool events (/api/v1/ai/ask tool events)
// Frontend filters entire Q&A book. list_documents; avoid copy that sounds like a "library" feel
const TOOL_EVENT_LABELS: Record<string, string> = {
  list_documents: "Confirm document info",
  read_blocks: "Read relevant paragraphs.",
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
// Date.now() unavailable in restricted environments; fallback to 0 (Throttle degrades to render every time, still correct)
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
  return `\n\nCitations:\n${citations
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item.title || "相关片段"}${item.page ? ` · 第 ${item.page} 页` : ""}${item.snippet ? `：${item.snippet}` : ""}`)
    .join("\n")}`;
}

export function describeToolEvent(event: AiToolEvent = {}) {
  const tool = `${event?.tool || ""}`.trim();
// Hide entire Q&A book. "Browse library" class progress
  if (tool === "list_documents") {
    return "";
  }
  const label = TOOL_EVENT_LABELS[tool] || tool;
const action = label ? `${label}ingâ¦` : "Retrieving documentsâ¦";
// No longer emphasized "Round n", more like standard chat progress
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

// Character typewriter animation(Non-streaming response, none. agentic Legacy look preserved on reference.)
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
  return `${normalized.slice(0, maxLength).trim()}…`;
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

// Traverse text nodes in container, replace [n] markers in-place with clickable reference buttons.
// Decouple rendering from Markdown: regardless of body marked output DOM or plain text fallback, can add citations.
// Skip code/pre Text within(Missing source text. Provide code or string to translate. [n] Not a reference)。
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

// Render answer text into bubble: prefer Markdown (browser), fallback to plain text node when marked is unavailable.
// Injected. [n] Quote button and footnote list. Full process. best-effort,Fallback on any step failure.
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

// Non-agentic citation (local Markdown retrieved title-style citation) as tail "Quote:" retain text block
  const plainCitationText = citationByRef.size ? "" : formatCitations(citations);

  // 1) Body:Markdown → fragment,Fallback to plain text on failure.
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

  // 2) [n] Inject quote button inline.(decouple marked)
  injectCitationButtons(body, citationByRef, documentRef, jumpToCitation);

// 3) Reference footnote list (Mount to bubble article, same level as body.)
  const messageEl = view.root;
  if (!citationByRef.size || typeof messageEl?.appendChild !== "function") {
    return;
  }
  messageEl.querySelector?.(".reader-ai-citations")?.remove?.();
  const footer = documentRef.createElement("div");
  footer.className = "reader-ai-citations";
  for (const citation of citationByRef.values()) {
    const pageIdx = Number(citation.page_idx);
const pageLabel = Number.isFinite(pageIdx) && pageIdx >= 0 ? ` Â· Page ${pageIdx + 1}` : "";
    footer.appendChild(createCitationButton(documentRef, {
      citation,
      className: "reader-ai-citation-item",
      jumpToCitation,
      text: `[${citation.ref}] ${clipSnippet(citation.snippet || "相关片段")}${pageLabel}`,
    }));
  }
  messageEl.appendChild(footer);
}

// During streaming Markdown Incremental rendering:Throttle by time(~90ms),Avoid per-token token re-parsing lag
// Returns { push(fullText), stop() }: push appends to latest accumulated text, stop cancels pending throttled render
// (finalize Pre-call,Prevent late trigger delay for overwrite reference button.)。
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
// Render body only during streaming Markdown; defer citation buttons/footnotes to finalize
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
