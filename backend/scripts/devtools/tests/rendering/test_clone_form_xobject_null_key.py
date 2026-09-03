from __future__ import annotations

import io
import sys
from pathlib import Path

import pikepdf
from pikepdf import Name

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.source_cleanup.pdf.xobject_ops import _clone_form_xobject


# A form xobject with `/StampId null` (the real shape of a publisher stamp
# form). It can only be constructed by reading original bytes that already
# contain a null value — pikepdf's Python API does not allow setting a
# dict key to None. The raw bytes are written here so qpdf rebuilds the
# xref when it opens the file.
_PDF_WITH_NULL_FORM_KEY = b"""%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100]
   /Resources << /XObject << /Fm0 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /XObject /Subtype /Form /BBox [0 0 10 10] /StampId null /Length 3 >>
stream
q Q
endstream
endobj
5 0 obj
<< /Length 8 >>
stream
/Fm0 Do
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
"""


def test_clone_form_xobject_skips_null_valued_keys() -> None:
    with pikepdf.open(io.BytesIO(_PDF_WITH_NULL_FORM_KEY)) as pdf:
        form = pdf.pages[0].obj[Name("/Resources")][Name("/XObject")][Name("/Fm0")]
        # Confirm the source actually has a null-valued key, otherwise the
        # test is meaningless.
        assert any(value is None for _key, value in form.items())

        cloned = _clone_form_xobject(pdf, form)

        assert cloned[Name("/Subtype")] == Name("/Form")
        assert list(cloned[Name("/BBox")]) == [0, 0, 10, 10]
        # The null key is removed without loss and the clone no longer
        # raises a ValueError.
        assert Name("/StampId") not in cloned
