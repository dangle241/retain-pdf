// Pure logic layer for annotation editor: no DOM/React, easy to unit test in node.
// Annotations are normalized server favorites (favorites), shape defined in tests/reader-annotations-vm.test.mjs

// Mapping of kind to display label: frozen to prevent accidental modification by UI layer.
export const ANNOTATION_KIND_META = Object.freeze({
  sentence: { label: "Sentence" },
  data: { label: "Data" },
  figure: { label: "Figure" },
});

// Sort by page number first, then createdAt: both export and list display rely on this stable order
export function sortAnnotations(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((a, b) => {
    const pageDelta = Number(a?.pageIdx ?? 0) - Number(b?.pageIdx ?? 0);
    if (pageDelta !== 0) {
      return pageDelta;
    }
    // createdAt is ISO string; lexicographic order equals time order
    const left = `${a?.createdAt || ""}`;
    const right = `${b?.createdAt || ""}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

// Group by page: UI collapses by page, export outputs page sections; both reuse this grouping.
export function groupAnnotationsByPage(list) {
  const groups = [];
  for (const annotation of sortAnnotations(list)) {
    const pageIdx = Number(annotation?.pageIdx ?? 0);
    const last = groups[groups.length - 1];
    if (last && last.pageIdx === pageIdx) {
      last.items.push(annotation);
    } else {
      groups.push({ pageIdx, items: [annotation] });
    }
  }
  return groups;
}

// Multi-line text to Markdown quote block: every line needs "> ", otherwise newline breaks out of blockquote
function toQuoteBlockLines(text) {
  return `${text || ""}`.split("\n").map((line) => `> ${line}`);
}

// Generate export Markdown: pure string assembly for precise unit tests and Copy/download reuse
export function buildAnnotationsMarkdown({ title = "", annotations = [] } = {}) {
  const heading = title ? `# ${title} annotations` : "# annotations";
  const groups = groupAnnotationsByPage(annotations);
  if (groups.length === 0) {
    return `${heading}\n\n(No annotations)\n`;
  }
  const lines = [heading, ""];
  for (const group of groups) {
    // pageIdx is 0-based; convert to 1-based page number for display
    lines.push(`## Page ${group.pageIdx + 1} pages`, "");
    for (const annotation of group.items) {
      lines.push(...toQuoteBlockLines(annotation?.quoteText));
      if (annotation?.translatedQuoteText) {
        // Translation immediately follows source quote block; use "——" to mark this as translation not source continuation
        lines.push(...toQuoteBlockLines(`—— ${annotation.translatedQuoteText}`));
      }
      if (annotation?.note) {
        lines.push("", `Note:${annotation.note}`);
      }
      // Blank line after each annotation; trailing "" ensures final newline in document
      lines.push("");
    }
  }
  return lines.join("\n");
}

// Extract jump anchor: Reader only needs page number + block id to locate source
export function annotationAnchor(annotation) {
  return {
    pageIdx: annotation?.pageIdx,
    blockId: annotation?.blockId,
  };
}




