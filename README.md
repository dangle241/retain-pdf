# RetainPDF: A PDF formatting-preserving translation tool

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>

There are many open-source projects in the formatting-preserving PDF space, but most focus on copyable and editable PDFs in scenarios with simple inline formulas.

RetainPDF was designed from the start to solve the formatting-preserving translation problem for all kinds of PDFs — especially image-based or scanned PDFs, and PDFs with complex inline formulas.

In the formatting-preserving translation field, RetainPDF takes a head-on approach against closed-source models and delivers better results in some scenarios, such as smaller output PDF size, faster overall speed, and finer font-size control.

In addition, this project is a full-stack system with separated frontend and backend, integrated OCR, translation, typesetting, and delivery. The architecture is kept as decoupled as possible, so it is ready to use out of the box and easy for future developers to extend, swap modules, or build on top of it.

## Brief comparison

| Project | Scanned PDF | Complex inline formula | Code not mistranslated | Table control | Custom translation strategy | Layout preservation | PDF compression optimization | API automation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDFMathTranslate | ❌ | ❌ | ❌ | Weak | Weak | Medium | Medium | ✅ |
| PolyglotPDF | ❌ | ❌ | ❌ | Weak | Weak | Medium | Medium | ✅ |
| Doc2X | ✅ | ✅ | ❌ | Medium | Weak | Strong | Weak | ❌ Not open |
| RetainPDF | ✅ | ✅ | ✅ | ✅ Toggleable | ✅ Configurable by rules | Strong | ✅ Continuously optimized | ✅ |

## Screenshots

### SCI paper

<p align="center">
  <img src="resources/brand/readme-gallery/image%201.png" alt="SCI example 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%202.png" alt="SCI example 2" width="860" />
</p>

### Image-based / scanned PDF

<p align="center">
  <img src="resources/brand/readme-gallery/image%203.png" alt="Scanned example 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%207.png" alt="Scanned example 2" width="860" />
</p>

### Books

<p align="center">
  <img src="resources/brand/readme-gallery/image%204.png" alt="Book example 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%205.png" alt="Book example 2" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%206.png" alt="Book example 3" width="860" />
</p>

## Quick start

If you just want to use it directly, go to [GitHub Releases](https://github.com/wxyhgk/retain-pdf/releases) and download the release package for your platform:

- Windows: download `Setup.exe`
- macOS: download `.dmg`
- Linux: download `.deb`

For LAN, team, or multi-device use, choose Docker deployment.

### Windows desktop

<p align="center">
  <img src="resources/brand/RetainPDF-desktop.png" alt="RetainPDF Windows desktop" width="860" />
</p>

### macOS note

The project does not currently have an Apple Developer account, so the macOS build may show a "damaged" warning on first launch. The file is not actually corrupted — this is caused by system signature verification. After dragging the app to `/Applications`, run:

```bash
sudo xattr -r -d com.apple.quarantine /Applications/RetainPDF.app
```

Then reopen the app.

### Docker deployment

This repository provides a Docker delivery directory:

- [docker/delivery/README.md](docker/delivery/README.md)
- [docker/delivery/docker-compose.yml](docker/delivery/docker-compose.yml)

Basic steps:

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/docker/delivery
docker compose up -d
```

Default URL after startup:

```text
http://127.0.0.1:40001
```

Default ports:

- `40001`: frontend page
- `41000`: Rust API
- `42000`: multipart async submit API

### Docker update

To update to the latest image:

```bash
cd retain-pdf/docker/delivery
docker compose pull
docker compose up -d
```

Or to switch to a specific version:

```bash
cd retain-pdf/docker/delivery
APP_IMAGE=wxyhgk/retainpdf-app:<version> \
WEB_IMAGE=wxyhgk/retainpdf-web:<version> \
docker compose up -d
```

After updating, run a status check:

```bash
docker compose ps
```

Current image addresses:

- [wxyhgk/retainpdf-app](https://hub.docker.com/r/wxyhgk/retainpdf-app)
- [wxyhgk/retainpdf-web](https://hub.docker.com/r/wxyhgk/retainpdf-web)

## Group chat

If you run into issues while using, deploying, or extending RetainPDF, feel free to join the QQ group for discussion.

- QQ group number: `1101779791`

<p align="center">
  <img src="resources/brand/QQ_Group.JPG" alt="RetainPDF QQ group QR code" width="280" />
</p>

## Developer

### Documentation entry point

Suggested reading order:

- [Contribution Guide](CONTRIBUTING.md)
- [Documentation index](doc/README.md)
- [Mainline documentation](doc/core/README.md)
- [References](doc/reference/README.md)
- [Ops and process records](doc/ops/README.md)
- [Pipeline stage contract](backend/scripts/runtime/pipeline/README.md)

### Code and submodule overview

- [Backend scripts](backend/scripts/README.md)
- `frontend/`: The currently shipping frontend and the input directory for the desktop bundle. The index/reader/detail pages have all been migrated to a React SPA (entry in `src/pages/`, bundled by esbuild; `src/js/` keeps the pure-logic core).
- `frontend-react/`: A separate React frontend migration area with its own tech stack (Vite + TypeScript). It does not currently replace `frontend/`.
- `desktop/`: Electron packaging and runtime shell.

### Current directory structure

- `frontend/`
  The currently shipping frontend, a three-page React SPA bundled by esbuild. Source is in `frontend/src/pages/`.
- `frontend-react/`
  A separate React frontend migration area with its own tech stack.
- `desktop/`
  Electron packaging, runtime shell, and the desktop frontend bundle.
- `backend/`
  Rust API, Python scripts, embedded Python, and historical workspace.
- `docker/`
  Dockerfiles, release scripts, and compose configuration for delivery.
- `experiments/`
  Standalone experiments, validation records, and temporary POCs.
- `data/`
  Local runtime output, task directories, and historical sample data.
- `resources/`
  Repo-level brand images, README figures, animations, sample files, and a local runtime archive entry.

### Current development status

RetainPDF now has a complete product chain:

- The Rust API handles uploads, tasks, library, events, artifacts, breakpoint recovery, and provider scheduling.
- The Python pipeline handles OCR normalization, translation, diagnostics, rendering, and PDF processing.
- `frontend/` is the current production entry, already a three-page React SPA; `frontend-react/` is a separate migration area with its own tech stack.
- Docker and desktop builds are the primary delivery formats.
- Mainline documentation is maintained for the API, database, artifacts, reader, glossary, and stage spec.

Current development priorities, following the mainline contract:

- Frontend: library, reader, task progress, and glossary experience.
- Rust API: boundary closure, database persistence, and artifact management.
- Python: translation consistency, formula protection, rendering stability, and diagnostic capability.
- Docker, desktop, and CI: reproducible delivery with test samples.
- Documentation: keep APIs, configuration, and directory structure descriptions synchronized with reality.

### Contributions welcome

If you are also interested in the following areas, you are welcome to extend the project:

- High-precision OCR and complex layout analysis
- Translation stability for long text blocks and formulas
- Layout backfill, font adaptation, and PDF rendering
- Desktop, Docker delivery, and engineering polish

Whether you specialize in algorithms, frontend, backend, or deployment, as long as you want to push "truly usable PDF formatting-preserving translation" further, you are welcome to join.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
