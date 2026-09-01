# MinerU API information

Place MinerU external interface documentation and in-project usage instructions here.
Its positioning and `paddle_ocr_api/` Different

- paddle_ocr_api/: RetainPDF's own OCR adapter documentation
- `mineru_api/`：MinerU API Reference

If you want to change RetainPDF main chain OCR integration, see first paddle_ocr_api/README.md and Rust API docs.

MinerU provides two document parsing APIs for different scenarios:

🎯 Precision parsing API — requires Token application, supports single/batch, tables/formulas/multi-format output
⚡ Agent lightweight parsing API — no login, IP rate limiting to prevent abuse, designed for AI Agent workflows
Mode comparison
Dimension   🎯 Precision parsing API   ⚡ Agent lightweight parsing API
Requires Token   ✅ Yes   ❌ No (IP rate limit)
Interface address   /api/v4/extract/task or /api/v4/file-urls/batch   /api/v1/agent/parse/url or /api/v1/agent/parse/file
Model version   pipeline (default) / vlm (recommended) / MinerU-HTML   fixed pipeline lightweight model
File size limit   ≤ 200MB   ≤ 10MB
Page limit   ≤ 600 pages   ≤ 20 pages
Batch support   ✅ Supports (≤ 200)   ❌ Single file
Output format   Zip package containing Markdown, JSON, and optional docx/html/latex   Only Markdown (CDN link)
Call method   Async (submit → poll)   Async (submit → poll)
🎯 Precision parsing API
Requires Token application, supports pipeline / vlm / MinerU-HTML three models, single and batch supported.

Overview
MinerU's precision parsing API is designed for complex documents requiring high-precision, deep structured extraction. It intelligently identifies and processes various complex layouts and multimodal content (such as tables, formulas, charts, images, multi-column layouts), converting document content into high-quality structured data.

Core features:

Extreme precision: industry-leading parsing accuracy, especially good at handling non-standard and complex documents
Deep structuring: not just text extraction, but deep understanding of document layout and semantics, outputting structured data with rich hierarchy
Multimodal support: comprehensive recognition and extraction of multiple content types including text, tables, images, formulas
Complex layout adaptation: effectively handles scanned documents, messy layouts, watermark interference, and other complex scenarios
File restrictions:

Restriction   Limit
File size limit   200 MB
Page limit   600 pages
Supported file types   PDF, images (png/jpg/jpeg/jp2/webp/gif/bmp), Doc, Docx, Ppt, PPTx
Single file parsing
Create parsing task
Interface description

Applicable for scenarios where parsing tasks are created via API; user must apply for Token. Note:

Single file size cannot exceed 200MB, page count cannot exceed 600 pages
Each account enjoys 2000 highest-priority parsing pages per day; beyond 2000 pages priority decreases
Due to network restrictions, github, aws and other foreign URLs may timeout
This interface does not support direct file upload
header must contain Authorization field, format: Bearer + space + Token
Python request example (for pdf, doc, ppt, image files):

import requests

token = "API token applied for on official website"
url = "https://mineru.net/api/v4/extract/task"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "url": "https://cdn-mineru.openxlab.org.cn/demo/example.pdf",
    "model_version": "vlm"
}

res = requests.post(url,headers=header,json=data)
print(res.status_code)
print(res.json())
print(res.json()["data"])
Python request example (for html files):

import requests

token = "API token applied for on official website"
url = "https://mineru.net/api/v4/extract/task"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "url": "https://****",
    "model_version": "MinerU-HTML"
}

res = requests.post(url,headers=header,json=data)
print(res.status_code)
print(res.json())
print(res.json()["data"])
CURL request example (for pdf, doc, ppt, image files):

curl --location --request POST 'https://mineru.net/api/v4/extract/task' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "url": "https://cdn-mineru.openxlab.org.cn/demo/example.pdf",
    "model_version": "vlm"
}'
CURL request example (for html files):

curl --location --request POST 'https://mineru.net/api/v4/extract/task' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "url": "https://****",
    "model_version": "MinerU-HTML"
}'
Request body parameter description

Parameter   Type   Required   Example   Description
url	string	是	https://static.openxlab.org.cn/
opendatalab/pdf/demo.pdf   File URL, supports .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp), .html multiple formats
is_ocr   bool   No   false   Whether to enable OCR, default false, only effective for pipeline, vlm models
enable_formula   bool   No   true   Whether to enable formula recognition, default true, only effective for pipeline, vlm models. Note: for vlm model, this parameter only affects inline formula parsing.
enable_table   bool   No   true   Whether to enable table recognition, default true, only effective for pipeline, vlm models
language   string   No   ch   Default document language ch; optional values see language reference. Only for pipeline, vlm models.
data_id   string   No   abc**   Data ID corresponding to parsed object. Composed of alphanumeric, underscore (), hyphen (-), dot (.), max 128 characters, can uniquely identify your business data.
callback   string   No   http://127.0.0.1/callback   URL for callback notification of parsing results, supports HTTP and HTTPS protocols. If empty, you must periodically poll for results. Callback interface must support POST, UTF-8, Content-Type: application/json, and parameters checksum and content. Parsing interface sets checksum and content according to rules and format, calls your callback interface.
checksum: string format, composed of user uid + seed + content, generated via SHA256. User UID can be found in personal center. To prevent tampering, when receiving push result, you can generate the string using the above algorithm and verify against checksum.
content: JSON string format, please parse back to JSON object. For example of content result, see task query result return example, corresponding to data part of task query result.
Note: After your server callback receives the push from Mineru parsing service, HTTP status 200 means success, other statuses mean failure. On failure, mineru will retry up to 5 times until success. After 5 retries still not success, no more retries; suggest checking callback interface status.
seed   string   No   abc**   Random string used for signature in callback notification request. Composed of letters, digits, underscore (), max 64 characters, user-defined. Used to verify request origin when receiving content safety callback notification.
Note: When using callback, this field must be provided.
extra_formats	[string]	No	["docx","html"]	markdown and json are default export formats and require no setting. This parameter only supports one or more of docx, html, or latex. Invalid for source files that are html.
page_ranges	string	No	1-600	Specifies page range as a comma-separated string. Example: "2,4-6" selects page 2 and pages 4 to 6 (inclusive, result: [2,4,5,6]); "2--2" selects from page 2 to the second-to-last page (where "-2" denotes the second-to-last page).
model_version   string   No   vlm   mineru model version, three options: pipeline, vlm, MinerU-HTML, default pipeline. If parsing HTML file, model_version must be explicitly set to MinerU-HTML; for non-HTML files, can choose pipeline or vlm.
no_cache   bool   No   false   Whether to bypass cache, default false. Our API server caches URL content for a period; set to true to ignore cached results and get latest content from URL.
cache_tolerance   int   No   900   Cache tolerance time (seconds), default 900 (15 minutes). Tolerable cache validity time for URL content; cache beyond this time will not be used. Effective when no_cache is false.
Response parameter description

Parameter   Type   Example   Description
code   int   0   Interface status code, success: 0
msg	string	ok	Interface processing message; success: "ok"
trace_id   string   c876cd60b202f2396de1f9e39a1b0172   Request ID
data.task_id   string   a90e6ab6-44f3-4554-b459-b62fe4c6b436   Extraction task ID, can be used to query task results
Response example

{
  "code": 0,
  "data": {
    "task_id": "a90e6ab6-44f3-4554-b4***"
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
Get task results
Interface description

Query extraction task progress via task_id; after task completion, interface responds with corresponding extraction details.

Python request example

import requests

token = "API token applied for on the official website"
task_id = "task_id returned from the previous task creation step"
url = f"https://mineru.net/api/v4/extract/task/{task_id}"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

res = requests.get(url, headers=header)
print(res.status_code)
print(res.json())
print(res.json()["data"])
CURL request example

curl --location --request GET 'https://mineru.net/api/v4/extract/task/{task_id}' \
--header 'Authorization: Bearer *****' \
--header 'Accept: */*'
Response parameter description

Parameter   Type   Example   Description
code   int   0   Interface status code, success: 0
msg	string	ok	Interface processing information, success: "ok"
trace_id   string   c876cd60b202f2396de1f9e39a1b0172   Request ID
data.task_id   string   abc**   Task ID
data.data_id   string   abc**   Data ID corresponding to parsed object.
Note: If data_id was passed in parsing request, corresponding data_id is returned here.
data.state   string   done   Task processing status: done: completed, pending: queued, running: parsing, failed: failed, converting: format converting
data.full_zip_url	string	https://cdn-mineru.openxlab.org.cn/
pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip   File parsing result zip
For non-HTML file parsing result details, see: https://opendatalab.github.io/MinerU/reference/output_files/ , where layout.json corresponds to middle processing result (middle.json), model.json corresponds to model inference result (model.json), _content_list.json corresponds to content list (content_list.json), full.md is Markdown parsing result.

HTML file parsing results differ slightly: full.md is Markdown parsing result, main.html is extracted body HTML
data.err_msg   string   Unsupported file format, please upload required file type   Parsing failure reason, effective when state=failed
data.extract_progress.extracted_pages   int   1   Number of pages parsed, effective when state=running
data.extract_progress.start_time   string   2025-01-20 11:43:20   Document parsing start time, effective when state=running
data.extract_progress.total_pages   int   2   Total document pages, effective when state=running
Response example

{
  "code": 0,
  "data": {
    "task_id": "47726b6e-46ca-4bb9-******",
    "state": "running",
    "err_msg": "",
    "extract_progress": {
      "extracted_pages": 1,
      "total_pages": 2,
      "start_time": "2025-01-20 11:43:20"
    }
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
{
  "code": 0,
  "data": {
    "task_id": "47726b6e-46ca-4bb9-******",
    "state": "done",
    "full_zip_url": "https://cdn-mineru.openxlab.org.cn/pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip",
    "err_msg": ""
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
Batch file parsing
Batch upload and parse local files.
Interface description

Applicable for local file upload parsing; batch request file upload links, after upload system automatically submits parsing tasks. Note:

Requested file upload links valid for 24 hours; complete upload within validity period.
When uploading file, no need to set Content-Type header.
After file upload complete, no need to call submit parsing task interface. System automatically scans uploaded files and submits parsing tasks.
Single request links cannot exceed 200.
header must contain Authorization field, format: Bearer + space + Token
Python request example (for pdf, doc, ppt, image files):

import requests

token = "API token applied for on the official website"
url = "https://mineru.net/api/v4/file-urls/batch"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "files": [
        {"name":"demo.pdf", "data_id": "abcd"}
    ],
    "model_version":"vlm"
}
file_path = ["demo.pdf"]
try:
    response = requests.post(url,headers=header,json=data)
    if response.status_code == 200:
        result = response.json()
        print('response success. result:{}'.format(result))
        if result["code"] == 0:
            batch_id = result["data"]["batch_id"]
            urls = result["data"]["file_urls"]
            print('batch_id:{},urls:{}'.format(batch_id, urls))
            for i in range(0, len(urls)):
                with open(file_path[i], 'rb') as f:
                    res_upload = requests.put(urls[i], data=f)
                    if res_upload.status_code == 200:
                        print(f"{urls[i]} upload success")
                    else:
                        print(f"{urls[i]} upload failed")
        else:
            print('apply upload url failed,reason:{}'.format(result["msg"]))
    else:
        print('response not success. status:{} ,result:{}'.format(response.status_code, response))
except Exception as err:
    print(err)
Python request example (for html files):

import requests

token = "API token applied for on the official website"
url = "https://mineru.net/api/v4/file-urls/batch"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "files": [
        {"name":"demo.html", "data_id": "abcd"}
    ],
    "model_version":"MinerU-HTML"
}
file_path = ["demo.html"]
try:
    response = requests.post(url,headers=header,json=data)
    if response.status_code == 200:
        result = response.json()
        print('response success. result:{}'.format(result))
        if result["code"] == 0:
            batch_id = result["data"]["batch_id"]
            urls = result["data"]["file_urls"]
            print('batch_id:{},urls:{}'.format(batch_id, urls))
            for i in range(0, len(urls)):
                with open(file_path[i], 'rb') as f:
                    res_upload = requests.put(urls[i], data=f)
                    if res_upload.status_code == 200:
                        print(f"{urls[i]} upload success")
                    else:
                        print(f"{urls[i]} upload failed")
        else:
            print('apply upload url failed,reason:{}'.format(result["msg"]))
    else:
        print('response not success. status:{} ,result:{}'.format(response.status_code, response))
except Exception as err:
    print(err)
CURL request example (for pdf, doc, ppt, image files):

curl --location --request POST 'https://mineru.net/api/v4/file-urls/batch' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "files": [
        {"name":"demo.pdf", "data_id": "abcd"}
    ],
    "model_version": "vlm"
}'
CURL request example (for html files):

curl --location --request POST 'https://mineru.net/api/v4/file-urls/batch' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "files": [
        {"name":"demo.html", "data_id": "abcd"}
    ],
    "model_version": "MinerU-HTML"
}'
CURL file upload example:

curl -X PUT -T /path/to/your/file.pdf 'https://****'
Request body parameter description

Parameter   Type   Required   Example   Description
enable_formula   bool   No   true   Whether to enable formula recognition, default true, only effective for pipeline, vlm models. Note: for vlm model, this parameter only affects inline formula parsing.
enable_table   bool   No   true   Whether to enable table recognition, default true, only effective for pipeline, vlm models.
language   string   No   ch   Specify document language, default ch. Optional values see language reference. Only for pipeline, vlm models.
file.name   string   Yes   demo.pdf   File name, supports .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp), .html multiple formats; strongly recommend using correct file extension.
file.is_ocr   bool   No   true   Whether to enable OCR, default false, only effective for pipeline, vlm models.
file.data_id   string   No   abc   Data ID corresponding to parsed object. Composed of alphanumeric, underscore (), hyphen (-), dot (.), max 128 characters, can uniquely identify your business data.
file.page_ranges	string	No	1-600	Specify page range as a comma-separated string. Example: "2,4-6" selects page 2 and pages 4 to 6 (inclusive, result: [2,4,5,6]); "2--2" selects from page 2 to the second-to-last page (where "-2" denotes the second-to-last page).
callback   string   No   http://127.0.0.1/callback   URL for callback notification of parsing results, supports HTTP and HTTPS protocols. If empty, you must periodically poll for results. Callback interface must support POST, UTF-8, Content-Type: application/json, and parameters checksum and content. Parsing interface sets checksum and content according to rules and format, calls your callback interface.
checksum: string format, composed of user uid + seed + content, generated via SHA256. User UID can be found in personal center. To prevent tampering, when receiving push result, you can generate the string using the above algorithm and verify against checksum.
content: JSON string format, please parse back to JSON object. For example of content result, see task query result return example, corresponding to data part of task query result.
Note: After your server callback receives the push from Mineru parsing service, HTTP status 200 means success, other statuses mean failure. On failure, mineru will retry up to 5 times until success. After 5 retries still not success, no more retries; suggest checking callback interface status.
seed   string   No   abc   Random string used for signature in callback notification request. Composed of letters, digits, underscore (), max 64 characters, user-defined. Used to verify request origin when receiving content safety callback notification.
Note: When using callback, this field must be provided.
extra_formats	[string]	No	["docx","html"]	Markdown and JSON are default export formats and need not be set. This parameter only supports one or more of docx, html, or latex. Invalid for source files that are HTML.
model_version   string   No   vlm   mineru model version, three options: pipeline, vlm, MinerU-HTML, default pipeline. If parsing HTML file, model_version must be explicitly set to MinerU-HTML; for non-HTML files, can choose pipeline or vlm.
Response parameter description

Parameter   Type   Example   Description
code   int   0   Interface status code, success: 0
msg	string	ok	Interface processing information, success: "ok"
trace_id   string   c876cd60b202f2396de1f9e39a1b0172   Request ID
data.batch_id   string   2bb2f0ec-a336-4a0a-b61a-****   Batch extraction task ID, can be used to query batch parsing results
data.file_urls	[string]	["https://mineru.oss-cn-shanghai.aliyuncs.com/api-upload/***"]	File upload links
Response example

{
  "code": 0,
  "data": {
    "batch_id": "2bb2f0ec-a336-4a0a-b61a-241afaf9cc87",
    "file_urls": ["https://***"]
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
url batch upload parsing
Interface description

Applicable for batch creation of extraction tasks via API. Note:

Single request cannot exceed 200 links.
File size cannot exceed 200MB, page count cannot exceed 600 pages.
Due to network restrictions, github, aws and other foreign URLs may timeout.
header must contain Authorization field, format: Bearer + space + Token
Python request example (for pdf, doc, ppt, image files):

import requests

token = "API token applied for on the official website"
url = "https://mineru.net/api/v4/extract/task/batch"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "files": [
        {"url":"https://cdn-mineru.openxlab.org.cn/demo/example.pdf", "data_id": "abcd"}
    ],
    "model_version": "vlm"
}
try:
    response = requests.post(url,headers=header,json=data)
    if response.status_code == 200:
        result = response.json()
        print('response success. result:{}'.format(result))
        if result["code"] == 0:
            batch_id = result["data"]["batch_id"]
            print('batch_id:{}'.format(batch_id))
        else:
            print('submit task failed,reason:{}'.format(result["msg"]))
    else:
        print('response not success. status:{} ,result:{}'.format(response.status_code, response))
except Exception as err:
    print(err)
Python request example (for html files):

import requests

token = "API token applied for on the official website"
url = "https://mineru.net/api/v4/extract/task/batch"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "files": [
        {"url":"https://***", "data_id": "abcd"}
    ],
    "model_version": "MinerU-HTML"
}
try:
    response = requests.post(url,headers=header,json=data)
    if response.status_code == 200:
        result = response.json()
        print('response success. result:{}'.format(result))
        if result["code"] == 0:
            batch_id = result["data"]["batch_id"]
            print('batch_id:{}'.format(batch_id))
        else:
            print('submit task failed,reason:{}'.format(result["msg"]))
    else:
        print('response not success. status:{} ,result:{}'.format(response.status_code, response))
except Exception as err:
    print(err)
CURL request example (for pdf, doc, ppt, image files):

curl --location --request POST 'https://mineru.net/api/v4/extract/task/batch' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "files": [
        {"url":"https://cdn-mineru.openxlab.org.cn/demo/example.pdf", "data_id": "abcd"}
    ],
    "model_version": "vlm"
}'
CURL request example (for html files):

curl --location --request POST 'https://mineru.net/api/v4/extract/task/batch' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "files": [
        {"url":"https://***", "data_id": "abcd"}
    ],
    "model_version": "MinerU-HTML"
}'
Request body parameter description

Parameter   Type   Required   Example   Description
enable_formula   bool   No   true   Whether to enable formula recognition, default true, only effective for pipeline, vlm models. Note: for vlm model, this parameter only affects inline formula parsing.
enable_table   bool   No   true   Whether to enable table recognition, default true, only effective for pipeline, vlm models.
language   string   No   ch   Specify document language, default ch. Optional values see language reference. Only for pipeline, vlm models.
file.url   string   Yes   demo.pdf   File link, supports .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp), .html multiple formats.
file.is_ocr   bool   No   true   Whether to enable OCR, default false, only effective for pipeline, vlm models.
file.data_id   string   No   abc   Data ID corresponding to parsed object. Composed of alphanumeric, underscore (), hyphen (-), dot (.), max 128 characters, can uniquely identify your business data.
file.page_ranges	string	No	1-600	Specify page range as a comma-separated string. Example: "2,4-6" selects page 2 and pages 4 to 6 (inclusive, result: [2,4,5,6]); "2--2" selects from page 2 to the second-to-last page (where "-2" denotes the second-to-last page).
callback   string   No   http://127.0.0.1/callback   URL for callback notification of parsing results, supports HTTP and HTTPS protocols. If empty, you must periodically poll for results. Callback interface must support POST, UTF-8, Content-Type: application/json, and parameters checksum and content. Parsing interface sets checksum and content according to rules and format, calls your callback interface.
checksum: string format, composed of user uid + seed + content, generated via SHA256. User UID can be found in personal center. To prevent tampering, when receiving push result, you can generate the string using the above algorithm and verify against checksum.
content: JSON string format, please parse back to JSON object. For example of content result, see task query result return example, corresponding to data part of task query result.
Note: After your server callback receives the push from Mineru parsing service, HTTP status 200 means success, other statuses mean failure. On failure, mineru will retry up to 5 times until success. After 5 retries still not success, no more retries; suggest checking callback interface status.
seed   string   No   abc**   Random string used for signature in callback notification request. Composed of letters, digits, underscore (_), max 64 characters, user-defined. Used to verify request origin when receiving content safety callback notification.
Note: When using callback, this field must be provided.
extra_formats	[string]	No	["docx","html"]	Markdown and JSON are default export formats and need not be set. This parameter only supports one or more of docx, html, or latex. Invalid for files where the source is html.
model_version   string   No   vlm   mineru model version, three options: pipeline, vlm, MinerU-HTML, default pipeline. If parsing HTML file, model_version must be explicitly set to MinerU-HTML; for non-HTML files, can choose pipeline or vlm.
no_cache   bool   No   false   Whether to bypass cache, default false. Our API server caches URL content for a period; set to true to ignore cached results and get latest content from URL.
cache_tolerance   int   No   900   Cache tolerance time (seconds), default 900 (15 minutes). Tolerable cache validity time for URL content; cache beyond this time will not be used. Effective when no_cache is false.
Request body example

{
  "files": [
    {
      "url": "https://cdn-mineru.openxlab.org.cn/demo/example.pdf",
      "data_id": "abcd"
    }
  ],
  "model_version": "vlm"
}
Response parameter description

Parameter   Type   Example   Description
code   int   0   Interface status code, success: 0
msg	string	ok	Interface processing message. Success: "ok"
trace_id   string   c876cd60b202f2396de1f9e39a1b0172   Request ID
data.batch_id   string   2bb2f0ec-a336-4a0a-b61a-****   Batch extraction task ID, can be used to query batch parsing results
Response example

{
  "code": 0,
  "data": {
    "batch_id": "2bb2f0ec-a336-4a0a-b61a-241afaf9cc87"
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
Batch get task results
Interface description

Query extraction task progress in batch via batch_id.

Python request example

import requests

token = "API token applied for on official website"
batch_id = "batch_id returned from previous batch submission"
url = f"https://mineru.net/api/v4/extract-results/batch/{batch_id}"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

res = requests.get(url, headers=header)
print(res.status_code)
print(res.json())
print(res.json()["data"])
CURL request example

curl --location --request GET 'https://mineru.net/api/v4/extract-results/batch/{batch_id}' \
--header 'Authorization: Bearer *****' \
--header 'Accept: */*'
Response parameter description

Parameter   Type   Example   Description
code   int   0   Interface status code, success: 0
msg	string	ok	Interface processing message. Success: "ok"
trace_id   string   c876cd60b202f2396de1f9e39a1b0172   Request ID
data.batch_id	string	2bb2f0ec-a336-4a0a-b61a-241afaf9cc87	batch_id
data.extract_result.file_name   string   demo.pdf   File name
data.extract_result.state   string   done   Task processing status: done: completed, waiting-file: waiting for file upload queued for parsing, pending: queued, running: parsing, failed: failed, converting: format converting
data.extract_result.full_zip_url   string   https://cdn-mineru.openxlab.org.cn/pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip   File parsing result zip
For non-HTML file parsing result details, see: https://opendatalab.github.io/MinerU/reference/output_files/ , where layout.json corresponds to middle processing result (middle.json), _model.json corresponds to model inference result (model.json), _content_list.json corresponds to content list (content_list.json), full.md is Markdown parsing result.

HTML file parsing results differ slightly: full.md is Markdown parsing result, main.html is extracted body HTML
data.extract_result.err_msg   string   Unsupported file format, please upload required file type   Parsing failure reason, effective when state=failed
data.extract_result.data_id   string   abc   Data ID corresponding to parsed object.
Note: If data_id was passed in parsing request, corresponding data_id is returned here.
data.extract_result.extract_progress.extracted_pages   int   1   Number of pages parsed, effective when state=running
data.extract_result.extract_progress.start_time   string   2025-01-20 11:43:20   Document parsing start time, effective when state=running
data.extract_result.extract_progress.total_pages   int   2   Total document pages, effective when state=running
Response example

{
  "code": 0,
  "data": {
    "batch_id": "2bb2f0ec-a336-4a0a-b61a-241afaf9cc87",
    "extract_result": [
      {
        "file_name": "example.pdf",
        "state": "done",
        "err_msg": "",
        "full_zip_url": "https://cdn-mineru.openxlab.org.cn/pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip"
      },
      {
        "file_name": "demo.pdf",
        "state": "running",
        "err_msg": "",
        "extract_progress": {
          "extracted_pages": 1,
          "total_pages": 2,
          "start_time": "2025-01-20 11:43:20"
        }
      }
    ]
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
Common error codes
Error code   Description   Solution
A0202   Token error   Check Token correctness, check for Bearer prefix or replace Token
A0211   Token expired   Replace with new Token
-500   Parameter error   Ensure parameter types and Content-Type correct
-10001   Service exception   Try again later
-10002   Request parameter error   Check request parameter format
-60001   Failed to generate upload URL, try again later   Try again later
-60002   Failed to get matching file format   File type detection failed; request file name and link should have correct extension, and file must be one of pdf, doc, docx, ppt, pptx, png, jp(e)g
-60003   File read failed   Check if file is corrupted and re-upload
-60004   Empty file   Upload valid file
-60005   File size exceeds limit   Check file size, max 200MB
-60006   Page count exceeds limit   Split file and retry
-60007   Model service temporarily unavailable   Try again later or contact support
-60008   File read timeout   Check URL accessibility
-60009   Task submission queue full   Try again later
-60010   Parsing failed   Try again later
-60011   Failed to get valid file   Ensure file uploaded
-60012   Task not found   Ensure task_id valid and not deleted
-60013   No permission to access task   Can only access own tasks
-60014   Delete running task   Running tasks cannot be deleted
-60015   File conversion failed   Can manually convert to PDF and upload
-60016   File conversion failed   File conversion to specified format failed, try other format export or retry
-60017   Retry count exceeded   Wait for model upgrade and retry
-60018   Daily parsing task limit reached   Try again tomorrow
-60019   Insufficient HTML file parsing quota   Try again tomorrow
-60020   File splitting failed   Try again later
-60021   Failed to read file pages   Try again later
-60022   Web page read failed   Possibly due to network issues or rate limiting; try again later
