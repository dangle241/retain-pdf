function markdownContent(payload = null) {
  return `${payload?.content_with_absolute_image_urls || payload?.content || payload?.markdown || ""}`.trim();
}

function normalizeText(text = "") {
  return `${text}`
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+]\([^)]+\)/g, " ")
    .replace(/[#>*_`~|[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  const normalized = normalizeText(text).toLowerCase();
  const latin = normalized.match(/[a-z0-9][a-z0-9-]{1,}/g) || [];
  const cjk = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  return [...new Set([...latin, ...cjk])].slice(0, 40);
}

function splitMarkdownSections(markdown = "") {
  const sections = [];
  let currentTitle = "文档开头";
  let current = [];
  for (const line of `${markdown}`.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (heading && current.join("\n").trim()) {
      sections.push({
        title: currentTitle,
        text: current.join("\n").trim(),
      });
      current = [];
    }
    if (heading) {
      currentTitle = heading[2].trim();
    }
    current.push(line);
  }
  if (current.join("\n").trim()) {
    sections.push({
      title: currentTitle,
      text: current.join("\n").trim(),
    });
  }
  return sections;
}

function scoreSection(section, tokens) {
  const haystack = normalizeText(`${section.title}\n${section.text}`).toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function excerpt(text = "", maxLength = 420) {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function buildAnswer(question, sections) {
  if (!sections.length) {
    return "我没有在当前 Markdown 里找到足够相关的片段。可以换一个更具体的问题，或确认这个任务已经生成 Markdown。";
  }
  const lines = [
    "我先基于当前 Markdown 找到这些相关片段：",
    ...sections.map((section, index) => `${index + 1}. ${section.title}：${excerpt(section.text)}`),
    "",
    `问题：${question}`,
  ];
  return lines.join("\n");
}

export function createReaderMarkdownAnswerer({
  loadMarkdownPayload,
  maxSections = 3,
}: any = {}) {
  let markdownPayload = null;
  let markdown = "";

  async function ensureLoaded(jobId) {
    if (markdown) {
      return markdown;
    }
    markdownPayload = await loadMarkdownPayload?.(jobId);
    markdown = markdownContent(markdownPayload);
    return markdown;
  }

  async function answer({ jobId = "", question = "", scope = "document", context = null }: any = {}) {
    const source = await ensureLoaded(jobId);
    if (!source) {
      throw new Error("当前任务还没有可用于问答的 Markdown。");
    }
    const tokens = tokenize(`${question} ${context?.page ? `第 ${context.page} 页` : ""}`);
    const sections = splitMarkdownSections(source)
      .map((section) => ({
        ...section,
        score: scoreSection(section, tokens),
      }))
      .sort((a, b) => b.score - a.score)
      .filter((section, index) => section.score > 0 || index < maxSections)
      .slice(0, maxSections);
    return {
      answer: buildAnswer(question, sections),
      citations: sections.map((section) => section.title),
      scope,
    };
  }

  return {
    answer,
    ensureLoaded,
  };
}
