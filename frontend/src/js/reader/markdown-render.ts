import { resolveMarkedVendorUrl } from "../runtime/vendor-url.js";

// AI Answer-only Markdown Safe rendering: lazy load marked, and **escape original HTML**â
// Model output `**bold**`/`## Header`/List renders, but `<img>`/`<script>` always display as
// Literal text, never enter DOM (Injection defense). Decouple quote button injection from this module (see chat.js).

let markedPromise = null;

function escapeHtml(value = "") {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// marked All versions renderer.html Input params differ(string or token),Fetch original text then escape.
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
// Use isolated instance to avoid polluting global marked configuration in markdown-preview
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

// Markdown text â Sanitized DocumentFragment. Throw runtime error if marked is unavailable (e.g., node tests).
// Caller handles fallback to plain text node.
export async function renderAiMarkdownFragment(text, { documentRef = globalThis.document } = {}) {
  const marked = await loadMarked();
  const template = documentRef.createElement("template");
  template.innerHTML = marked.parse(`${text || ""}`, { async: false });
  // Double safety:Even if renderer.html Slipped through,Remove script nodes and inline events./Dangerous link
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
