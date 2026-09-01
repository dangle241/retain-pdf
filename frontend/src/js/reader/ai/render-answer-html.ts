// AI Final render: protect [n] citations â Markdown + formulas â restore [n].
// Use lightweight preview in streaming phase to avoid repeated operations. MathJax / full page innerHTML.
//
// Security model (audit P0-1 Fix alignment. legacy markdown-render.ts two-layer defense):
// 1. parse Period: Independent Marked Instance's renderer.html Raw model output HTML All
//    Escape text. Use `String.prototype.replace`. → skipped: regex for all cases, add when specific escape needed.——iframe srcdoc / object / embed Wait vectors become literals at source.
// 2. DOM Period: template Secondary removal of script-like nodes after parsing, on* Properties, javascript: links
//    (Double insurance, to cover marked Behavior change with MathJax any remaining leaks outside
// Answer body final ReaderAssistantThread root.innerHTML Inject. This file is
// Single sanitization checkpoint——Changes mandatory. tests/render-answer-html.test.mjs Vector lock.

import { Marked } from "marked";
import { parseMarkdownWithMath } from "../markdown-math.js";

const CITE_PREFIX = "\uE010CITE_";
const CITE_SUFFIX = "\uE011";

function escapeHtml(value: string): string {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Extract [1] [2]â¦, avoid marked treating them as reference links. */
export function protectNumericCitations(source: string): {
  text: string;
  refs: string[];
} {
  const refs: string[] = [];
  const text = `${source ?? ""}`.replace(/\[(\d+)\]/g, (_m, n: string) => {
    const token = `${CITE_PREFIX}${refs.length}${CITE_SUFFIX}`;
    refs.push(n);
    return token;
  });
  return { text, refs };
}

export function restoreNumericCitations(html: string, refs: string[]): string {
  if (!refs.length) return html;
  return `${html ?? ""}`.replace(
    new RegExp(`${CITE_PREFIX}(\\d+)${CITE_SUFFIX}`, "g"),
    (_m, idx: string) => {
      const n = refs[Number(idx)];
      return n != null ? `[${n}]` : "";
    },
  );
}

/** Stream preview: lightweight escaping + Newline, preserve [n] Literal. */
export function renderStreamingPreviewHtml(text: string): string {
  const escaped = escapeHtml(text || "");
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

/** marked v18 renderer.html Input param compat (token Object or string) */
function rawHtmlText(input: unknown): string {
  if (typeof input === "string") return input;
  const token = input as { raw?: string; text?: string } | null;
  return `${token?.raw ?? token?.text ?? ""}`;
}

// Standalone instance: renderer.html Fully escape = First line of defense; avoid global pollution of marked config.
const answerMarked = new Marked();
answerMarked.setOptions({ gfm: true, breaks: true });
answerMarked.use({
  renderer: {
    html: (input: unknown) => escapeHtml(rawHtmlText(input)),
  },
});

const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|data:text\/html)/i;

function sanitizeHtml(html: string): string {
  const doc = globalThis.document;
  if (!doc) {
// No DOM Environment (theoretically impossible: this function is only called in the browser rendering path)ââ
    // Escape all source code. Never pass raw.
    return escapeHtml(html);
  }
  const template = doc.createElement("template");
  template.innerHTML = html;
  const content = template.content;
  // Second layer of defense: even if renderer.html Remove script nodes from leaks too.
  content
    .querySelectorAll("script, iframe, object, embed, base, link, meta, form")
    .forEach((node) => node.remove());
  content.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        node.removeAttribute(attribute.name);
        continue;
      }
      if (
        (name === "href" || name === "src" || name === "xlink:href")
        && DANGEROUS_URL_RE.test(attribute.value)
      ) {
        node.removeAttribute(attribute.name);
        continue;
      }
// Remove target=_blank: Desktop Electron treats it as window.open â openExternal
      if (name === "target") {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return template.innerHTML;
}

/** Switching branches changes the session. message id Body identical; cache prevents remount Flash "pendingâfinal". */
const FINAL_HTML_CACHE = new Map<string, string>();
const FINAL_HTML_CACHE_MAX = 48;

export function peekFinalAnswerHtmlCache(text: string): string | null {
  const key = `${text || ""}`.trim();
  if (!key) return null;
  return FINAL_HTML_CACHE.get(key) ?? null;
}

function putFinalAnswerHtmlCache(text: string, html: string): void {
  const key = `${text || ""}`.trim();
  if (!key) return;
  if (FINAL_HTML_CACHE.has(key)) FINAL_HTML_CACHE.delete(key);
  FINAL_HTML_CACHE.set(key, html);
  while (FINAL_HTML_CACHE.size > FINAL_HTML_CACHE_MAX) {
    const oldest = FINAL_HTML_CACHE.keys().next().value;
    if (oldest == null) break;
    FINAL_HTML_CACHE.delete(oldest);
  }
}

/**
 * Final answer HTMLprotect citations → Protect formula → marked → MathJax → Restore references.
 */
export async function renderFinalAnswerHtml(text: string): Promise<string> {
  const src = `${text || ""}`;
  if (!src.trim()) return "";

  const cached = FINAL_HTML_CACHE.get(src);
  if (cached != null) return cached;

  const { text: withoutCites, refs } = protectNumericCitations(src);

  const html = await parseMarkdownWithMath(withoutCites, (markdown) => {
    const raw = String(answerMarked.parse(markdown, { async: false } as { async: boolean }));
    return sanitizeHtml(raw);
  });

  const out = restoreNumericCitations(html, refs);
  putFinalAnswerHtmlCache(src, out);
  return out;
}
