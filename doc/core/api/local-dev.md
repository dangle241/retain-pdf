# Local startup and configuration

## Backend

Start from repository root:

```bash
cd /path/to/retain-pdf/backend/rust_api
RUST_API_BIND_HOST=0.0.0.0 \
RUST_API_DATA_ROOT=../../data \
RUST_API_SCRIPTS_DIR=../scripts \
cargo run
```

Default listening:

- Complete API：`http://127.0.0.1:41000`
- multipart Async submit API：`http://127.0.0.1:42000`

## Frontend

```bash
cd /path/to/retain-pdf/frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

Frontend API base rules:

- Prefer reading window.__FRONT_RUNTIME_CONFIG__.apiBase.
- If not configured, fallback to current host's 41000.
- Docker Deliver Default `FRONT_API_BASE=` Empty. Nginx Same origin `/api/` Proxy to backend.

## Auth.

Except GET /health, other APIs require authentication by default.

```http
X-API-Key: your-rust-api-key
```

X-API-Key is the backend whitelist key for accessing Rust API, not DeepSeek/MinerU/Paddle model or OCR key.

Local key sources:

- `backend/rust_api/auth.local.json`
- Environment variable RUST_API_KEYS

In Docker, docker/delivery/docker/auth.local.json's api_keys must match FRONT_X_API_KEY in docker/delivery/docker/web.env.

## Common environment variables

- RUST_API_ROOT: Rust API root directory.
- `RUST_API_PROJECT_ROOT`Project root directory.
- `RUST_API_BIND_HOST`Listen address, default `0.0.0.0`。
- `RUST_API_PORT`Complete API Default port `41000`。
- `RUST_API_SIMPLE_PORT`：multipart Async submission port (default) `42000`。
- `RUST_API_DATA_ROOT`Runtime data root directory.
- `RUST_API_DATA_DIR`Old alias, only `RUST_API_DATA_ROOT` Use when not set.
- `RUST_API_SCRIPTS_DIR`：Python Scripts
- `PYTHON_BIN`：Python Executable file.
- `RUST_API_UPLOAD_MAX_BYTES`Normal upload size limit,`0` No limit.
- RUST_API_UPLOAD_MAX_PAGES: normal upload page limit; 0 means no limit.
- `RUST_API_MAX_RUNNING_JOBS`Max concurrent tasks.

## Docker Config location

Compose Actual read:

- `docker/delivery/docker/app.env`
- `docker/delivery/docker/web.env`
- `docker/delivery/docker/auth.local.json`

Not in repo root. `docker/*.env`。
