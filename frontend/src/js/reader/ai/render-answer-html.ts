// Kết xuất cuối câu trả lời AI: bảo vệ trích dẫn [n] → Markdown + công thức → khôi phục [n].
// Giai đoạn streaming dùng xem trước nhẹ để tránh chạy MathJax / innerHTML toàn trang nhiều lần.
//
// Mô hình bảo mật (sửa kiểm toán P0-1, khớp hai lớp phòng vệ của legacy markdown-render.ts):
// 1. Pha parse: renderer.html của instance Marked độc lập chuyển toàn bộ HTML thô từ mô hình
//    thành văn bản đã escape; các vector như iframe srcdoc / object / embed trở thành literal ngay từ nguồn.
// 2. Pha DOM: sau khi template phân tích, xóa lần hai các nút dạng script, thuộc tính on* và liên kết javascript:
//    (bảo vệ kép trước thay đổi hành vi marked và mọi thứ lọt ngoài MathJax).
// Nội dung trả lời cuối cùng được chèn qua root.innerHTML của ReaderAssistantThread; tệp này là
// cổng làm sạch duy nhất; thay đổi phải vượt khóa vector trong tests/render-answer-html.test.mjs.

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

/** Tách [1] [2]… để marked không coi chúng là reference link. */
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

/** Xem trước streaming: escape nhẹ + xuống dòng, giữ literal [n]. */
export function renderStreamingPreviewHtml(text: string): string {
  const escaped = escapeHtml(text || "");
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

/** Tương thích tham số đầu vào của renderer.html trong marked v18 (đối tượng token hoặc chuỗi). */
function rawHtmlText(input: unknown): string {
  if (typeof input === "string") return input;
  const token = input as { raw?: string; text?: string } | null;
  return `${token?.raw ?? token?.text ?? ""}`;
}

// Phiên bản độc lập: renderer.html thoát toàn bộ ký tự để tạo lớp bảo vệ đầu tiên; không làm ảnh hưởng cấu hình marked toàn cục
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
    // Môi trường không có DOM (về lý thuyết không xảy ra vì hàm này chỉ được gọi trong luồng kết xuất trình duyệt):
    // Ưu tiên thoát toàn bộ ký tự để hiển thị mã nguồn, không cho nội dung thô đi qua
    return escapeHtml(html);
  }
  const template = doc.createElement("template");
  template.innerHTML = html;
  const content = template.content;
  // Lớp bảo vệ thứ hai: loại bỏ các nút dạng script ngay cả khi renderer.html bỏ sót
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
      // Loại bỏ target=_blank: Electron desktop coi nó là window.open → openExternal
      if (name === "target") {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return template.innerHTML;
}

/** Khi đổi nhánh hội thoại, message id thay đổi nhưng nội dung giữ nguyên; cache tránh nhấp nháy “đang chờ → hoàn tất” khi remount. */
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
 * HTML của câu trả lời cuối: bảo vệ trích dẫn → bảo vệ công thức → marked → MathJax → khôi phục trích dẫn.
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
