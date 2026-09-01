// Annotation editor pure logic layer: no DOM/React, for node unit tests.
// Annotation is server-side favorite.(favorites)Normalized records,See shape. tests/reader-annotations-vm.test.mjs

// kind Map to display copy:Freeze to prevent accidental mutation by presentation layer.
export const ANNOTATION_KIND_META = Object.freeze({
  sentence: { label: "Sentences" },
  data: { label: "数据" },
  figure: { label: "图表" },
});

// Sort by page number, then creation time.:Export and list display depend on this stable order.
export function sortAnnotations(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((a, b) => {
    const pageDelta = Number(a?.pageIdx ?? 0) - Number(b?.pageIdx ?? 0);
    if (pageDelta !== 0) {
      return pageDelta;
    }
// createdAt is ISO string, Lexicographic order equals chronological order.
    const left = `${a?.createdAt || ""}`;
    const right = `${b?.createdAt || ""}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

// Group by page:Display layer collapses by page; export generates subsections per page.,Reuse this grouping result.
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

// Multiline text conversion Markdown Blockquote:Append to every line. "> ",Otherwise, newlines break out of the quote.
function toQuoteBlockLines(text) {
  return `${text || ""}`.split("\n").map((line) => `> ${line}`);
}

// Generate for export. Markdown:Pure string concatenation,Facilitates precise unit testing and replication./Reuse download
export function buildAnnotationsMarkdown({ title = "", annotations = [] } = {}) {
const heading = title ? `# ${title} Annotations` : "# Annotations";
  const groups = groupAnnotationsByPage(annotations);
  if (groups.length === 0) {
return `${heading}\n\n(No annotations)\n`;
  }
  const lines = [heading, ""];
  for (const group of groups) {
// pageIdx is 0-indexed, Convert for display. 1-indexed page number
lines.push(`## Page ${group.pageIdx + 1}`, "");
    for (const annotation of group.items) {
      lines.push(...toQuoteBlockLines(annotation?.quoteText));
      if (annotation?.translatedQuoteText) {
// Translation follows original quote block closely, use ââ Mark as translation, not source continuation.
        lines.push(...toQuoteBlockLines(`—— ${annotation.translatedQuoteText}`));
      }
      if (annotation?.note) {
        lines.push("", `Notes:${annotation.note}`);
      }
      // Leave blank line after each comment,trailing "" Ensure entire file ends with newline.
      lines.push("");
    }
  }
  return lines.join("\n");
}

// Extract jump anchor: Reader only needs page number + block id Locates original text.
export function annotationAnchor(annotation) {
  return {
    pageIdx: annotation?.pageIdx,
    blockId: annotation?.blockId,
  };
}
