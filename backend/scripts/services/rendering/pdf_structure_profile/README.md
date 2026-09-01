# PDF Structure Profile

`pdf_structure_profile` Record Original PDF Built-in structure frame, rather than OCR Box, does not record color.

Suitable for OCR normalized Generated after completion, before translation starts, because it depends only on:

- Original PDF
- normalized item's item_id/bbox, used to establish mapping from OCR item to PDF built-in text objects, required to define key values.

Recommended output file name: `pdf_structure_profile.v1.json`Subsequent deletion phase: read directly.

- text_objects: PDF text object boxes from page.get_bboxlog().
- text_spans: visible text from page.get_text("dict"), updated span boxes.
- path_objects: path/vector boxes from bboxlog containing markers that block physical deletion.
- image_objects: image frames from bboxlog.
- form_xobjects: XObject boxes from page.get_xobjects().
- item_hits: best overlap mapping between OCR items and PDF text objects.

This profile is the fact layer for deletion policy. Does not decide deletion, does not modify PDF.
