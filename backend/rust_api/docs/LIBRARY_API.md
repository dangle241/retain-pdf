# Library API Contract

Library **external HTTP** Merged into unified. API Entry point:

- [RetainPDF Backend API Main Entry](../../../doc/core/api/index.md)

**YAGNI. Premature abstraction. Implement flat structure first. Add layers only when complexity forces separation.**Modular monolith, not microservices:

```text
routes/library*.rs, collections.rs
  → services/library_api.rs
      → services/library/*
```

Collaboration notes:

- [RUST_API_ARCHITECTURE.md](../RUST_API_ARCHITECTURE.md) §2.2–2.3
- [RUST_API_DIRECTORY_MAP.md](../RUST_API_DIRECTORY_MAP.md)
- [BOUNDARIES.md](../BOUNDARIES.md)（Library Facade）

Keep this file for backward compatibility with old links. Do not maintain interface field documentation here.
