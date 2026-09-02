import { resolveMarkedVendorUrl } from "../runtime/vendor-url.js";

// Safe Markdown rendering for AI answers: lazy-load marked and **escape raw HTML** —
// model output like `**bold**`/`## Title`/lists renders, but `<img>`/`<script>` always displays as
// literal text, never enters DOM (injection prevention). Citation button injection is decoupled from this module (see chat.js).

let markedPromise = null;

function escapeHtml(value = "") {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// marked renderer.html input varies by version (string or token); normalize to source then escape
function rawHtmlText(input) {
  if (typeof input === "string") {
    return input;
  }
  return `${input?.raw ?? input?.text ?? ""}`;
}

function loadMarked() {
  if (!markedPromise) {
    markedPromise = import(resolveMarkedVendorUrl())
      .then(({ marked, Marked }) => {
        // Use standalone instance to avoid polluting markdown-preview global marked config
        const instance = typeof Marked === "function" ? new Marked() : marked;
        instance.use({
          renderer: {
            html: (input) => escapeHtml(rawHtmlText(input)),
          },
        });
        return instance;
      })
      .catch((error) => {
        markedPromise = null;
        throw error;
      });
  }
  return markedPromise;
}

// Markdown text → sanitized DocumentFragment. Throws if marked is unavailable (e.g. node tests);
// caller is responsible for falling back to plain text nodes.
export async function renderAiMarkdownFragment(text, { documentRef = globalThis.document } = {}) {
  const marked = await loadMarked();
  const template = documentRef.createElement("template");
  template.innerHTML = marked.parse(`${text || ""}`, { async: false });
  // Double insurance: remove script-like nodes, inline events, and dangerous links even if renderer.html missed them
  const content = template.content;
  content.querySelectorAll("script, iframe, object, embed, img, svg").forEach((node) => node.remove());
  content.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  content.querySelectorAll("a[href]").forEach((anchor) => {
    if (/^\s*javascript:/i.test(anchor.getAttribute("href") || "")) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
  return content;
}



