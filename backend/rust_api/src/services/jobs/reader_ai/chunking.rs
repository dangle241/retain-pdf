use crate::models::api::ReaderAiCitationView;

const MAX_CHUNK_CHARS: usize = 1_600;
const SNIPPET_CHARS: usize = 240;

#[derive(Debug, Clone)]
pub(super) struct MarkdownChunk {
    pub title: String,
    pub page: Option<i64>,
    pub text: String,
}

impl MarkdownChunk {
    pub(super) fn citation(&self) -> ReaderAiCitationView {
        ReaderAiCitationView {
            title: self.title.clone(),
            page: self.page,
            snippet: self.snippet(),
        }
    }

    pub(super) fn snippet(&self) -> String {
        snippet(&self.text)
    }
}

pub(super) fn chunk_markdown(markdown: &str) -> Vec<MarkdownChunk> {
    let mut builder = ChunkBuilder::default();
    let mut chunks = Vec::new();

    for line in markdown.lines() {
        let trimmed = line.trim();
        if let Some(title) = heading_title(trimmed) {
            builder.flush(&mut chunks);
            builder.title = title;
            continue;
        }
        if trimmed.is_empty() {
            builder.flush(&mut chunks);
            continue;
        }
        if image_only(trimmed) {
            continue;
        }
        builder.push(trimmed, &mut chunks);
    }
    builder.flush(&mut chunks);
    chunks
}

#[derive(Default)]
struct ChunkBuilder {
    title: String,
    text: String,
}

impl ChunkBuilder {
    fn push(&mut self, line: &str, chunks: &mut Vec<MarkdownChunk>) {
        if !self.text.is_empty() {
            self.text.push('\n');
        }
        self.text.push_str(line);
        if self.text.chars().count() >= MAX_CHUNK_CHARS {
            self.flush(chunks);
        }
    }

    fn flush(&mut self, chunks: &mut Vec<MarkdownChunk>) {
        let text = self.text.trim();
        if text.is_empty() {
            self.text.clear();
            return;
        }
        chunks.push(MarkdownChunk {
            title: fallback_title(&self.title),
            page: page_from_text(text),
            text: text.to_string(),
        });
        self.text.clear();
    }
}

fn heading_title(line: &str) -> Option<String> {
    let stripped = line.strip_prefix('#')?;
    let title = stripped.trim_start_matches('#').trim();
    if title.is_empty() {
        return None;
    }
    Some(title.to_string())
}

fn image_only(line: &str) -> bool {
    line.starts_with("![") || line.starts_with("<img ") || line.starts_with("<div ")
}

fn fallback_title(title: &str) -> String {
    if title.trim().is_empty() {
        "Document".to_string()
    } else {
        title.trim().to_string()
    }
}

fn page_from_text(text: &str) -> Option<i64> {
    for marker in ["page ", "Page ", "第"] {
        if let Some(page) = page_after_marker(text, marker) {
            return Some(page);
        }
    }
    None
}

fn page_after_marker(text: &str, marker: &str) -> Option<i64> {
    let (_, tail) = text.split_once(marker)?;
    let digits = tail
        .chars()
        .skip_while(|ch| !ch.is_ascii_digit())
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return None;
    }
    digits.parse().ok()
}

fn snippet(text: &str) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    normalized.chars().take(SNIPPET_CHARS).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunks_by_heading_and_paragraph() {
        let chunks =
            chunk_markdown("# Intro\n\nFirst paragraph.\n\nSecond paragraph.\n# Methods\nBody");
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].title, "Intro");
        assert_eq!(chunks[2].title, "Methods");
    }
}
