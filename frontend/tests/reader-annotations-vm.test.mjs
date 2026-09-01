import test from "node:test";
import assert from "node:assert/strict";
import {
  ANNOTATION_KIND_META,
  annotationAnchor,
  buildAnnotationsMarkdown,
  groupAnnotationsByPage,
  sortAnnotations,
} from "../src/js/reader/annotations/view-model.js";

// Create min comment.:Override only relevant fields in tests.
function makeAnnotation(overrides = {}) {
  return {
    favoriteId: "fav-1",
    documentId: "doc-1",
    jobId: "job-1",
    pageIdx: 0,
    blockId: "blk-1",
    kind: "sentence",
quoteText: "Original text",
    translatedQuoteText: "",
    note: "",
    createdAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

test("sortAnnotations Sort by page number ascending first.,Same page, ascending by creation time.", () => {
  const annotations = [
    makeAnnotation({ favoriteId: "c", pageIdx: 2, createdAt: "2026-07-01T00:00:00Z" }),
    makeAnnotation({ favoriteId: "b", pageIdx: 0, createdAt: "2026-07-02T00:00:00Z" }),
    makeAnnotation({ favoriteId: "a", pageIdx: 0, createdAt: "2026-07-01T00:00:00Z" }),
  ];
  assert.deepEqual(sortAnnotations(annotations).map((item) => item.favoriteId), ["a", "b", "c"]);
  // Do not mutate input array.
  assert.deepEqual(annotations.map((item) => item.favoriteId), ["c", "b", "a"]);
});

test("sortAnnotations Non-array input returns empty array.", () => {
  assert.deepEqual(sortAnnotations(null), []);
  assert.deepEqual(sortAnnotations(undefined), []);
  assert.deepEqual(sortAnnotations("oops"), []);
});

test("groupAnnotationsByPage Group by page; preserve time order within group.", () => {
  const groups = groupAnnotationsByPage([
    makeAnnotation({ favoriteId: "p3", pageIdx: 3 }),
    makeAnnotation({ favoriteId: "p0-late", pageIdx: 0, createdAt: "2026-07-02T00:00:00Z" }),
    makeAnnotation({ favoriteId: "p0-early", pageIdx: 0, createdAt: "2026-07-01T00:00:00Z" }),
  ]);
  assert.deepEqual(
    groups.map((group) => ({ pageIdx: group.pageIdx, ids: group.items.map((item) => item.favoriteId) })),
    [
      { pageIdx: 0, ids: ["p0-early", "p0-late"] },
      { pageIdx: 3, ids: ["p3"] },
    ],
  );
  assert.deepEqual(groupAnnotationsByPage([]), []);
});

test("buildAnnotationsMarkdown output title/Section/Blockquote/translation/note", () => {
  const markdown = buildAnnotationsMarkdown({
    title: "Attention",
    annotations: [
      // Pass arguments in intentionally random order.,Sort then group before export.
      makeAnnotation({ favoriteId: "f2", pageIdx: 1, quoteText: "第二页数据", kind: "data" }),
      makeAnnotation({
        favoriteId: "f1",
        pageIdx: 0,
        quoteText: "line1\nline2",
        translatedQuoteText: "trans1\ntrans2",
note: "Important",
        createdAt: "2026-07-02T00:00:00Z",
      }),
      makeAnnotation({ favoriteId: "f0", pageIdx: 0, quoteText: "图注", kind: "figure" }),
    ],
  });
  assert.equal(
    markdown,
"# Attention Annotations\n" +
      "\n" +
"## Page 1\n" +
      "\n" +
"> Figure caption\n" +
      "\n" +
      "> line1\n" +
      "> line2\n" +
      "> —— trans1\n" +
      "> trans2\n" +
      "\n" +
"Note: Important\n" +
      "\n" +
"## Page 2\n" +
      "\n" +
"> Page 2 data\n",
  );
});

test("buildAnnotationsMarkdown Empty list placeholder", () => {
assert.equal(buildAnnotationsMarkdown({ title: "Attention", annotations: [] }), "# Attention Annotations\n\n(No comments.)\n");
assert.equal(buildAnnotationsMarkdown({}), "# Annotations\n\n(No comments yet)\n");
});

test("annotationAnchor Expose only page numbers and blocks for navigation. id", () => {
  assert.deepEqual(annotationAnchor(makeAnnotation({ pageIdx: 4, blockId: "blk-9" })), { pageIdx: 4, blockId: "blk-9" });
});

test("ANNOTATION_KIND_META Covers three annotation types", () => {
  assert.deepEqual(Object.keys(ANNOTATION_KIND_META), ["sentence", "data", "figure"]);
});
