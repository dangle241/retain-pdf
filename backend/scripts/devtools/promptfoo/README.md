# Gỡ lỗi Promptfoo Dịch

Mục tiêu của framework này không phải phát lại toàn bộ sách mà là thu gọn "tại sao một mục dịch không được dịch / suy giảm / tạo ra đầu ra bẩn" thành vòng lặp nhỏ nhất có thể tái tạo, so sánh được và tự động kiểm thử hồi quy.

Quy trình hiện tại được chia thành ba lớp:

- Rust API Debug Interface
  - `GET /api/v1/jobs/{job_id}/translation/diagnostics`
  - `GET /api/v1/jobs/{job_id}/translation/items`
  - `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
  - `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`
- Single-Item Python Replay
  - `backend/scripts/devtools/replay_translation_item.py`
- Promptfoo Fixture/Eval
  - Files `scan_drift.py`, `capture_case.py`, `run_eval.py`, `promptfooconfig*.yaml` in the current directory

## 1. Đầu tiên định vị mục cụ thể

Khi API cục bộ đang chạy, bạn có thể xem trước:

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items?final_status=kept_origin&q=protocol'
```

Nếu không muốn viết curl thủ công, cũng có thể dùng trực tiếp:

```bash
python backend/scripts/devtools/translation_debug_api.py \
  items \
  --job-id <job_id> \
  --final-status kept_origin \
  --q protocol
```

Hoặc xem trực tiếp từng item:

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items/<item_id>'
```

```bash
python backend/scripts/devtools/translation_debug_api.py \
  item \
  --job-id <job_id> \
  --item-id <item_id>
```

Khi cần phát lại trực tiếp quy trình dịch hiện tại:

```bash
python backend/scripts/devtools/translation_debug_api.py \
  replay \
  --job-id <job_id> \
  --item-id <item_id>
```

## 2. Quét sẵn drift chiến lược giữa Saved và Replay

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --limit 10
```

Mặc định, nó sẽ:

- Lọc trước theo `final_status=kept_origin` ở phía saved
- Phát lại từng mục ứng viên
- Xuất các mục có drift chiến lược

Nếu muốn xuất tất cả ứng viên đã replay:

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --all
```

## 3. Ghi lại ví dụ xấu làm fixture

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --expected-contains 红移 \
  --expected-contains 荧光 \
  --required-term 551\ nm
```

Mặc định, nó sẽ ghi vào:

- `backend/scripts/devtools/promptfoo/fixtures/cases.csv`
- `backend/scripts/devtools/promptfoo/fixtures/cases/<job>--<item>.json`

Artifact JSON case này sẽ đồng thời đóng băng thông tin sau:

- Saved item snapshot
- Current replay result
- policy_before / policy_after
- Drift summary

Nếu lần này chỉ muốn ghi phía saved, không muốn kích hoạt replay:

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --skip-replay
```

Các trường đa giá trị trong CSV dùng `||` phân tách, thuận tiện sửa trực tiếp:

- `expected_contains`
- `required_terms`
- `forbidden_substrings`

## 4. Chạy promptfoo

Điều kiện tiên quyết:

- Python trực tiếp dùng môi trường kho hiện tại
- `promptfoo` yêu cầu `Node 20.20+` hoặc `22.22+`

`run_eval.py` sẽ ưu tiên dùng `node` từ shell hiện tại; nếu phiên bản hiện tại không đủ nhưng phiên bản tương thích được cài trong `~/.nvm/versions/node`, nó sẽ tự chuyển mà không cần bạn `nvm use` thủ công.

Chỉ đánh giá đầu ra replay hiện tại:

```bash
python backend/scripts/devtools/promptfoo/run_eval.py
```

Đồng thời xem so sánh giữa "replay hiện tại" và "đầu ra lưu trữ gốc của tác vụ":

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --compare
```

Nếu chỉ muốn xác minh trước fixture và quy trình assertion mà không gọi mô hình:

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --saved-only
```

Thực tế bên dưới thực thi:

```bash
npx promptfoo@latest eval -c backend/scripts/devtools/promptfoo/promptfooconfig.yaml
```

`run_eval.py` sẽ tự động:

- Kiểm tra xem fixture có trống không
- Chỉ định `PROMPTFOO_PYTHON` đến Python hiện tại
- Tiêm đường dẫn fixture vào `PROMPTFOO_TRANSLATION_FIXTURES`

## Quy tắc Assertion

Fixture hiện tại hỗ trợ một số quy tắc cứng mặc định:

- Độ dài đầu ra tối thiểu
- Có phải tiếng Trung bắt buộc xuất hiện
- Cụm từ dịch bắt buộc
- Thuật ngữ phải giữ nguyên
- Phân đoạn đầu ra bẩn bị cấm
- Số công thức `$...$` / `$$...$$` có khớp văn bản nguồn không

Tất cả quy tắc này nằm ở:

- `backend/scripts/devtools/promptfoo/assertions.py`

## GitHub CI

Kho hiện tại có thể kết nối trực tiếp với GitHub Actions để chạy `current-replay`.

Workflow tương ứng:

- `.github/workflows/translation-replay.yml`

Thiết kế chia thành hai lớp:

- First run pure local unit tests
  - `test_promptfoo_case_tools.py`
  - `test_promptfoo_harness_regressions.py`
  - `test_translation_debug_tools.py`
- Then run the actual promptfoo current-replay
  - `python backend/scripts/devtools/promptfoo/run_eval.py`

### Tại sao GitHub CI không phụ thuộc `data/jobs/`

Sau khi GitHub runner checkout, mặc định nó không thể truy cập thư mục làm việc cục bộ `data/jobs/...` của bạn, nên artifact case hiện tại sẽ đóng băng thêm:

- Main parameters of the translate spec
- The entire translated payload of the corresponding page

Như vậy, ngay cả khi không có thư mục job trên runner, CI vẫn có thể phát lại trực tiếp từ:

- `backend/scripts/devtools/promptfoo/fixtures/cases/*.json`

### GitHub Secrets Bắt buộc

Cần cấu hình:

- `RETAIN_TRANSLATION_API_KEY`

Mục đích:

- For the provider current-replay to call the model

PR từ fork mặc định không thể truy cập secrets, nên workflow sẽ:

- Still run local unit tests
- Skip current-replay eval that requires secrets

### Artifacts

Workflow sẽ upload:

- Current replay promptfoo JSON results
- Current fixture CSV
- Case JSON artifacts
- `~/.promptfoo/logs/*.log`

## Ranh giới ứng dụng

Toolkit này ưu tiên giải quyết các vấn đề liên quan đến "chiến lược dịch / fallback / keep-origin / prompt / đầu ra provider bất thường".

Nó không trực tiếp giải quyết:

- OCR block extraction errors
- Continuation merging errors
- Typst layout errors

Tuy nhiên, bạn có thể dùng toolkit này để nhanh chóng xác định: vấn đề xảy ra "trước dịch" hay "sau dịch".
