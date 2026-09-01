// Markdown Formula: at marked Previously extracted $...$ / $$...$$Render after use MathJax Translate SVG。
// If unprotected, marked treats a_b as emphasis, breaking the formula block.

export type MarkdownMathSlot = {
  token: string;
  tex: string;
  display: boolean;
};

export type ExtractMarkdownMathResult = {
  text: string;
  slots: MarkdownMathSlot[];
};

type MathJaxEngine = {
  convert(tex: string, display: boolean): string;
};

const TOKEN_PREFIX = "\uE000RP_MATH_";
const TOKEN_SUFFIX = "\uE001";

let enginePromise: Promise<MathJaxEngine> | null = null;

function escapeHtml(value: string): string {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeToken(index: number): string {
  return `${TOKEN_PREFIX}${index}${TOKEN_SUFFIX}`;
}

/**
* Extract LaTeX snippets to placeholders to prevent marked from breaking subscripts or commands.
 * Block-level order. $$ / \\[ \\] → Inline \\( \\) / $...$
 */
export function extractMarkdownMath(source: string): ExtractMarkdownMathResult {
  const slots: MarkdownMathSlot[] = [];
  let text = `${source ?? ""}`;

  const push = (rawTex: string, display: boolean): string => {
    const tex = `${rawTex ?? ""}`.trim();
    if (!tex) {
      return display ? `$$${rawTex}$$` : `$${rawTex}$`;
    }
    const token = makeToken(slots.length);
    slots.push({ token, tex, display });
    return token;
  };

  // Block-level
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => push(tex, true));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => push(tex, true));
// Inline \( ... \)
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => push(tex, false));
  // 行内 $...$Single line.OCR Frequent $ Add space inside parentheses
  text = text.replace(/(?<![\\$])\$(?!\$)((?:\\.|[^$\n])+?)\$(?!\$)/g, (full, tex: string) => {
    if (!`${tex}`.trim()) {
      return full;
    }
    return push(tex, false);
  });

  return { text, slots };
}

function loadMathJaxEngine(): Promise<MathJaxEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [
        { mathjax },
        { TeX },
        { SVG },
        { liteAdaptor },
        { RegisterHTMLHandler },
        { AllPackages },
      ] = await Promise.all([
        import("mathjax-full/js/mathjax.js"),
        import("mathjax-full/js/input/tex.js"),
        import("mathjax-full/js/output/svg.js"),
        import("mathjax-full/js/adaptors/liteAdaptor.js"),
        import("mathjax-full/js/handlers/html.js"),
        import("mathjax-full/js/input/tex/AllPackages.js"),
      ]);

      const adaptor = liteAdaptor();
      RegisterHTMLHandler(adaptor);
      const document = mathjax.document("", {
        InputJax: new TeX({
          packages: AllPackages,
        }),
        OutputJax: new SVG({ fontCache: "none" }),
      });

      return {
        convert(tex: string, display: boolean): string {
          const node = document.convert(tex, { display });
          const html = adaptor.outerHTML(node);
// Complete failure (no SVG). Throw only on total failure for outer fallback; show SVG if it contains merror, as merror SVGs are still displayed.
          if (!/<svg[\s>]/i.test(html)) {
            throw new Error("mathjax produced no svg");
          }
          return html;
        },
      };
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export function renderMathFallbackHtml(tex: string, display: boolean): string {
  const body = `<code class="reader-md-math-error" title="Formula rendering failed.">${escapeHtml(tex)}</code>`;
  if (display) {
    return `<div class="reader-md-math reader-md-math-display reader-md-math-failed">${body}</div>`;
  }
  return `<span class="reader-md-math reader-md-math-inline reader-md-math-failed">${body}</span>`;
}

export function wrapMathSvgHtml(svgHtml: string, display: boolean): string {
  const cls = display
    ? "reader-md-math reader-md-math-display"
    : "reader-md-math reader-md-math-inline";
  const tag = display ? "div" : "span";
  return `<${tag} class="${cls}">${svgHtml}</${tag}>`;
}

/** Replace HTML placeholders with MathJax SVG (fallback to code snippet on failure). HTML Replace placeholder in with MathJax SVG(Fallback to code snippet on failure). */
export async function materializeMarkdownMathHtml(
  html: string,
  slots: MarkdownMathSlot[],
): Promise<string> {
  if (!slots.length) {
    return html;
  }

  let engine: MathJaxEngine | null = null;
  try {
    engine = await loadMathJaxEngine();
  } catch {
    engine = null;
  }

  let out = `${html ?? ""}`;
  for (const slot of slots) {
    let replacement: string;
    if (engine) {
      try {
        replacement = wrapMathSvgHtml(engine.convert(slot.tex, slot.display), slot.display);
      } catch {
        replacement = renderMathFallbackHtml(slot.tex, slot.display);
      }
    } else {
      replacement = renderMathFallbackHtml(slot.tex, slot.display);
    }
    out = out.split(slot.token).join(replacement);
  }
  return out;
}

/** Full pipeline: protection formula → marked.parse → restore SVG。 */
export async function parseMarkdownWithMath(
  markdown: string,
  parseMarkdown: (src: string) => string,
): Promise<string> {
  const { text, slots } = extractMarkdownMath(markdown);
  const html = parseMarkdown(text);
  return materializeMarkdownMathHtml(html, slots);
}
