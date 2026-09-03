# Markdown Layer description

## 1. Layer definition

`layoutParsingResults[*].markdown` Yes. `prunedResult` Code generation enhance readability. Simplify logic. Markdown/HTML Quick preview string OCR text, paragraph structure, and embedded resources. Each `layoutParsingResults` Items attach own. Simplify: remove attachments. Add when required. `markdown.text`(the entire page's Markdown content) and `markdown.images`Syntax error. Fix: Close parenthesis. `<img>` Image asset referenced by tag), so it's not a new one. OCR schemaSyntax error. Fix: Remove comma. `prunedResult` Flattened, readable information display.

## 2. Field structure

- `text`: A complete Markdown/HTML script. The actual content has its own titles (e.g. `## 1. JSON Split Profile`Paragraph text English./Mixed Chinese script, inline formulas (`$ \lambda = 1.5 $`、`$ E = mc^{2} $`Syntax error. Remove unnecessary characters. `<div>`/`<img>` Labels are nearly a coherent narrative pieced together from page text fragments. This string contains no coordinate or type markers; all layout/Data loss. Restore category info.
- `images`: Dictionary where keys are Markdown Relative path usage incorrect. Ensure correct path. Check: `./example`. `imgs/img_in_image_box_256_840_937_1091.jpg`), value is a directly accessible HTTP URL(often with authorization signature). You can treat it as `text` in `<img>` Tag reference table: Whenever Markdown Code missing. Provide details. `src="imgs/...jpg"`，`images[key]` Get actual image file path to embed preview in render layer.

## 3. Relationship with `prunedResult`

`markdown` Not original OCR structured output of, which is derived from `prunedResult` The derived 'soft format' view.`prunedResult` Still trusted by upstream and downstream interfaces. canonical struct, which stores page size、`parsing_res_list`(with `block_bbox`、`block_label`、`block_order`), layout/Paragraph Abstraction & Other metadataSyntax error. Fix: Remove comma. `markdown` Just string together the text content and image references into a readable document. The difference between the two means: if you need to locate a certain... blockRestore X/YDetermine if heading or table, then view. `prunedResult`, cannot rely on `markdown`。

## 4. Use Cases and Constraints

- **suitable**: Debugging/Quick visual check during troubleshooting. OCR Generate summary. Display overview. Use Markdown. `text` Invalid syntax. Fix: Correct input. Markdown/HTML Level (Title,`<img>`formula) simple alternative screenshot; verify. `images` Quoted asset Can it be accessed?
- **Not suitable**as adapter primary input; treat as downstream schema(e.g. `document.v1`、normalized document); used to determine structure tag/type, paragraph boundaries or tables/Illustration relationship——this information in `markdown` `middle` retains order only; original categories and coordinates removed.
- **Cautious**：`markdown.images` Only URL Mapping, excluding `block_bbox` Await location data. Reconstructing image area requires composition. `prunedResult` + `outputImages` Metadata.

## 5. Continue adapter Integration recommendations

New adapter or provider implementation should use `prunedResult` (or `normalized_document`) as primary pipeline input; `markdown.text`/`markdown.images` only as auxiliary debug view. Common flow:

1. Use `prunedResult`'s `parsing_res_list`, `block_label`, `block_bbox` etc. to complete structured organization.
2. If manual confirmation of extraction results needed, read in debug script. `markdown.text`Check title content formula coherence.
3. `markdown.images` provide renderable preview or use as `![alt](URL)` output in markdown, but do not use to determine image attribution or coordinates.

Keeping this thread helps keep schema main path unaffected by single component failure. Documentation markdown deviates from specification.
