// AI 气泡正文的命令式Rendering层:从旧 src/js/reader/ai/chat.js 原样搬运语义——
// 流式 Markdown 节流Rendering(~90ms), [n] 引用按钮就地注入, 引用脚注List, 
// 字符打字机动画, tool Events文案.React 只Rendering气泡骨架(article/label/body),
// 正文内容(Markdown DOM/引用按钮)不进虚拟 DOM,All经 message view 句柄写入.
//
// message view 句柄:{ root, body } 指向 React 已提交的气泡元素
// (root=article,body=.reader-ai-message-body-el),由组件 ref 回调填充.

import { renderAiMarkdownFragment } from "../../../../js/reader/markdown-render.js";
import type { PageAnchor } from "../../../../js/reader/types.js";

// agentic ToolsEvents的语义化文案(/api/v1/ai/ask 的 tool Events)
// 整books问答前端会过滤 list_documents；文案也避免"Library"感
const TOOL_EVENT_LABELS: Record<string, string> = {
  list_documents: "确认Documents信息",
  read_blocks: "阅读相关Paragraph",
  search_favorites: "查找Favorite",
  search_fulltext: "SearchDocuments内容",
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
  // Date.now() 在部m受限环境不Ready,退化为 0(节流退化为每次都Rendering,仍正确)
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
  return `\n\n引用: \n${citations
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item.title || "Relevant snippet"}${item.page ? ` · Page ${item.page} pages` : ""}${item.snippet ? `: ${item.snippet}` : ""}`)
    .join("\n")}`;
}

export function describeToolEvent(event: AiToolEvent = {}) {
  const tool = `${event?.tool || ""}`.trim();
  // 整books问答不展示"浏览Library"类Progress
  if (tool === "list_documents") {
    return "";
  }
  const label = TOOL_EVENT_LABELS[tool] || tool;
  const action = label ? `正在${label}...` : "Searching documents...";
  // 不再强调"Page n 轮", 更像普通聊天Progress
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

// 字符打字机动画(非流式回答且None agentic 引用时保留的旧观感)
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

// 遍历容器内的文books节点,把 [n] 标记就地替换为可点击引用按钮.
// 与 Markdown Rendering解耦:None论正文yes marked 产出的 DOM 还yes纯文books回退,都能加引用.
// 跳过 code/pre 内的文books(代码里的 [n] 不yes引用).
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

// 把Answer文booksRendering进气泡:优先 Markdown(浏览器),marked 不Ready时回退纯文books节点.
// 随后注入 [n] 引用按钮与引用脚注List.全程 best-effort,任何一stepFailed都降级.
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

  // 非 agentic 引用(books地 Markdown Search的Title式引用)作为尾部"引用: "文books块保留
  const plainCitationText = citationByRef.size ? "" : formatCitations(citations);

  // 1) 正文:Markdown → fragment,Failed则纯文books
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

  // 2) [n] 引用按钮就地注入(解耦 marked)
  injectCitationButtons(body, citationByRef, documentRef, jumpToCitation);

  // 3) 引用脚注List(挂在气泡 article 上,与正文平级)
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

// 流式期间的 Markdown 增量Rendering:按Time节流(~90ms),避免逐 token 重parse卡顿.
// 返回 { push(fullText), stop() }:push 排入最新累积文books,stop Cancel挂起的节流Rendering
// (finalize 前调用,避免晚触发覆盖引用按钮).
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
    // 流式期间只Rendering正文 Markdown,引用按钮/脚注留到 finalize
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




