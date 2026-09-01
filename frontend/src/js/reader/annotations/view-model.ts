// annotationsEdit器的纯逻辑层:不碰 DOM/React,便于 node 单测
// annotations即服务端Favorite(favorites)归一化后的记录,形状见 tests/reader-annotations-vm.test.mjs

// kind 到展示文案的映射:冻结防止展示层意外改写
export const ANNOTATION_KIND_META = Object.freeze({
  sentence: { label: "Sentence" },
  data: { label: "Data" },
  figure: { label: "Figure" },
});

// 先按pages码再按CreatedTimeSort:导出与List展示都依赖这个稳定顺序
export function sortAnnotations(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((a, b) => {
    const pageDelta = Number(a?.pageIdx ?? 0) - Number(b?.pageIdx ?? 0);
    if (pageDelta !== 0) {
      return pageDelta;
    }
    // createdAt yes ISO 字符串,字典序即Time序
    const left = `${a?.createdAt || ""}`;
    const right = `${b?.createdAt || ""}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

// 按pagesm组:展示层按pages折叠, 导出按pages出小节,都复用这一份m组结果
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

// 多行文books转 Markdown 引用块:每一行都要加 "> ",no则new line会跳出引用
function toQuoteBlockLines(text) {
  return `${text || ""}`.split("\n").map((line) => `> ${line}`);
}

// 生成导出用 Markdown:纯字符串拼装,方便精确单测与Copy/下载复用
export function buildAnnotationsMarkdown({ title = "", annotations = [] } = {}) {
  const heading = title ? `# ${title} annotations` : "# annotations";
  const groups = groupAnnotationsByPage(annotations);
  if (groups.length === 0) {
    return `${heading}\n\n(No annotations)\n`;
  }
  const lines = [heading, ""];
  for (const group of groups) {
    // pageIdx yes 0 基,展示给人看要转成 1 基pages码
    lines.push(`## Page ${group.pageIdx + 1} pages`, "");
    for (const annotation of group.items) {
      lines.push(...toQuoteBlockLines(annotation?.quoteText));
      if (annotation?.translatedQuoteText) {
        // Translation紧贴Source引用块,用 —— 标记这yesTranslation而非Source续行
        lines.push(...toQuoteBlockLines(`—— ${annotation.translatedQuoteText}`));
      }
      if (annotation?.note) {
        lines.push("", `Note:${annotation.note}`);
      }
      // 每entriesannotations后留空行,末尾的 "" 也保证整documents以new line结尾
      lines.push("");
    }
  }
  return lines.join("\n");
}

// 提取跳转锚点:Reader只requiredpages码 + 块 id 就能Locate回Source
export function annotationAnchor(annotation) {
  return {
    pageIdx: annotation?.pageIdx,
    blockId: annotation?.blockId,
  };
}




