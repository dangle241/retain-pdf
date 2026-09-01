"""retainpdf-ai: resident AI service (agentic Search Q&A).

Architecture positioning:Rust API Sole writer to data plane.(documents/favorites/FTS);
This service is stateless.,Inference loop + tool registry,Tools Rust API Read data.
Direct read task dir artifacts get block text. Batch translate. worker Irrelevant to this service.
"""

__version__ = "0.1.0"
