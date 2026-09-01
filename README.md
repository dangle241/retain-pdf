# RetainPDF:PDF Preserve formatting translation tool

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>


Many open-source formatting-preservation projects exist, but all center on copyability and editability. PDFand scenarios with simple inline formulas.

RetainPDF From the outset, it was to address all kinds of. PDF layout‑preserving translation issues, especially image‑based/Scanned PDFand inline formula rendering issues..

Typesetting-preserving translation: confront closed-source models head-on.,And performs better in some scenarios, such as after translation. PDF Volume, overall speed, and font size controls.

Additionally, this project uses a frontend-backend separation architecture.OCRStack project. Full-stack. Translation, typesetting, delivery pipeline integrated. Decoupled structure. Ready to use. Easy for devs to extend, swap modules, customize.


Brief comparison:

| Project | Scan type PDF | Complex inline formula | Code preserved verbatim. | Table Controls | custom translation strategy | Layout preservation | PDF Compression Optimization | API Automation. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDFMathTranslate | ❌ | ❌ | ❌ | Weak | Weak | Medium | Medium | ✅ |
| PolyglotPDF | ❌ | ❌ | ❌ | Weak | Weak | Medium | Medium | ✅ |
| Doc2X | ✅ | ✅ | ❌ | Medium | Weak | Strong | Weak | ❌ Not open. |
| RetainPDF | ✅ | ✅ | ✅ | ✅ Toggle | ✅ Configurable by rules. | Strong | ✅ Continuous optimization | ✅ |

## Mockup

### SCI Paper

<p align="center">
  <img src="resources/brand/readme-gallery/image%201.png" alt="SCI Example 1" width="860" />
</p>

<p align="center">
<img src="resources/brand/readme-gallery/image%202.png" alt="SCI Example 2" width="860" />
</p>

### Image type / Scanned version PDF

<p align="center">
  <img src="resources/brand/readme-gallery/image%203.png" alt="Scanned sample 1" width="860" />
</p>

<p align="center">
<img src="resources/brand/readme-gallery/image%207.png" alt="Scanned Example 2" width="860" />
</p>

### Books

<p align="center">
  <img src="resources/brand/readme-gallery/image%204.png" alt="Book Example 1" width="860" />
</p>

<p align="center">
<img src="resources/brand/readme-gallery/image%205.png" alt="Book Example 2" width="860" />
</p>

<p align="center">
<img src="resources/brand/readme-gallery/image%206.png" alt="Book Example 3" width="860" />
</p>

## Quick Start

For direct use, go to [GitHub Releases](https://github.com/wxyhgk/retain-pdf/releases) Download platform release package.

- WindowsDownload First `Setup.exe`
- macOSDownload `.dmg`
- Linux: Download `.deb`

For LAN, team, or multi-device use, choose: Docker deploy.

### Windows Desktop

<p align="center">
  <img src="resources/brand/RetainPDF-desktop.png" alt="RetainPDF Windows Desktop" width="860" />
</p>

### macOS Prompt

Because currently there is no Apple Developer account,macOS On first launch, the app may show a “damaged” warning. Not actual corruption—system signature verification. Drag the app to `/Applications` Then execute:

```bash
sudo xattr -r -d com.apple.quarantine /Applications/RetainPDF.app
```

Then reopen the application.

### Docker Deployment

The current repository provides Docker Delivery directory:

- [docker/delivery/README.md](docker/delivery/README.md)
- [docker/delivery/docker-compose.yml](docker/delivery/docker-compose.yml)

Basic steps:

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/docker/delivery
docker compose up -d
```

Default access after startup:

```text
http://127.0.0.1:40001
```

Default port:

- `40001`Frontend page
- `41000`：Rust API
- `42000`：multipart Async Submit API

### Docker Update

If only updating to the latest image version:

```bash
cd retain-pdf/docker/delivery
docker compose pull
docker compose up -d
```

Alternatively, to switch to a specific image version:

```bash
cd retain-pdf/docker/delivery
APP_IMAGE=wxyhgk/retainpdf-app:<version> \
WEB_IMAGE=wxyhgk/retainpdf-web:<version> \
docker compose up -d
```

After update, run a status check:

```bash
docker compose ps
```

Current image address:

- [wxyhgk/retainpdf-app](https://hub.docker.com/r/wxyhgk/retainpdf-app)
- [wxyhgk/retainpdf-web](https://hub.docker.com/r/wxyhgk/retainpdf-web)

## Group chat

If you are using, deploying, or modifying the code. RetainPDF If you encounter issues, you are welcome to join. QQ Discuss in the group chat.

- QQ Group number:`1101779791`

<p align="center">
  <img src="resources/brand/QQ_Group.JPG" alt="RetainPDF QQ Group QR Code" width="280" />
</p>

## Developer


### Documentation entry point

Suggested reading order:

- [Contribution Guide](CONTRIBUTING.md)
- [Table of Contents](doc/README.md)
- [Mainline Documentation](doc/core/README.md)
- [References](doc/reference/README.md)
- [Ops and Process Records](doc/ops/README.md)
- [Pipeline Phase Contract](backend/scripts/runtime/pipeline/README.md)

### Code and submodule description

- [Backend Script Documentation](backend/scripts/README.md)
- `frontend/`The frontend currently used in production is also the desktop client. bundle input directory;index/reader/detail Pages migrated. React SPA(`src/pages/` It is the entrance to the new world,esbuild Package,`src/js/` Keep only the pure logic core.
- `frontend-react/`Another React Frontend Migration Area (independent tech stack:Vite + TypeScript), currently not directly replaced. `frontend/`.
- `desktop/`：Electron Desktop packaging and runtime shell.

### Current directory structure

- `frontend/`
  Current production frontend, three pages. React SPA（esbuild package), see source code `frontend/src/pages/`。
- `frontend-react/`
  Another React Frontend Migration Zone (Independent Tech Stack).
- `desktop/`
  Electron Desktop packaging, runtime shell, and desktop frontend. bundle。
- `backend/`
  Rust API、Python Scripting, Embedded PythonHistory workspace.
- `docker/`
  DockerfilePublish script run. Output deliverable artifacts. compose Configuration.
- `experiments/`
  Independent experiments, validation records, and temporary POC。
- `data/`
  Local runtime output, task directory, historical sample data.
- `resources/`
  Repository-level brand image,README Figures, animations, sample files, and local follow-up. runtime Archive entry.

### Current dev status

RetainPDF Complete product chain established:

- Rust API Responsible for upload, tasks, library, events, artifacts, checkpoint recovery, and Provider Schedule.
- Python pipeline Responsible OCR Normalization, translation, diagnostics, rendering, and PDF processing.
- `frontend/` Current production entry, already three pages. React SPA;`frontend-react/` This is the migration area for another independent technology stack.
- Docker And desktop is the current primary delivery format.
- API, database, artifact, reader, glossary and stage spec Mainline documentation already maintained.

Current dev priority follows mainline contract, focus:

- Frontend Library,reader, task progress, and glossary experience.
- Rust API boundary closure, database persistence, and artifact Management.
- Python Translation consistency, formula protection, rendering stability, and diagnostic capability.
- DockerDesktopCI Reproducible delivery with test samples.
- Documentation and Reality API / Configuration / Keep directory structures synchronized.

### Contributions welcome

If you are also interested in the following directions, welcome to continue this project together.

- High precision OCR / Complex Layout Analysis
- Translation stability for long text blocks and formulas.
- Layout backfill, font adaptation, and PDF Render
- Desktop,Docker Delivery and Engineering Refinement

Whether you excel in algorithms, frontend, backend, or deployment, as long as you want to make "truly usable PDF Deepen formatting-preserving translation. Join us.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
