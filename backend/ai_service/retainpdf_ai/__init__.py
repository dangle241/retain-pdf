"""retainpdf-ai: resident AI service (agentic retrieval-based Q&A).

Architecture position: Rust API is the sole data-plane writer (documents/favorites/FTS);
this service is stateless, inference loop + tool registry, tools read data via Rust API and
read task directory artifacts directly for block text. Translation batch worker is unrelated to this service.
"""

__version__ = "0.1.0"
