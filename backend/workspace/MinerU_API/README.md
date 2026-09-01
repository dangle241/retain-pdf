MinerU Provides two document parsing modes. APIMeet varied scenario needs:

🎯 Precision parsing API — requires token, supports single file/batch, table/formula/multi-format output
⚡ Agent Lightweight parsing API — No login required,IP Rate limiting to prevent abuse, specifically for AI Agent Workflow design
Mode Comparison
Comparison dimension	🎯 Precision parsing API	⚡ Agent lightweight parsing API
Token required	✅ Yes	❌ No (IP rate limit)
Endpoint	/api/v4/extract/task or /api/v4/file-urls/batch	/api/v1/agent/parse/url or /api/v1/agent/parse/file
Model Version	pipeline(default)/ vlm(Recommend) / MinerU-HTML	Fixed pipeline Lightweight model
table/Formula Recognition	✅ Supported (configurable)	❌ Disabled (for speed)
File size limit	≤ 200MB	≤ 10MB
Page limit	≤ 600 pages	≤ 20 pages
Batch support	✅ Support (≤ 200 items)	❌ Single file
Output format	ZIP package containing Markdown, JSON, and can export as docx/html/latex	Only Markdown (CDN link)
Invocation	Async (submit → poll)	Async (submit → poll)
🎯 Precision parsing API
Requires token application, supports pipeline / vlm / MinerU-HTML three models. Supports single file and batch.

Overview
MinerU Precise parsing. API Designed for high-precision deep structured extraction of complex documents. Smartly recognizes and processes complex layouts, multimodal content (tables, math formulas, charts, images, multi-column layouts). Converts document content into high-quality structured data.

Core features:

Ultimate precision: industry-leading parsing accuracy, especially for non-standard and complex documents.
Deep structuring: beyond text extraction, deeply understand layout and semantics, output structured data with rich hierarchy.
Multimodal support: comprehensive support for accurate recognition and extraction of multiple content types including text, tables, images, and formulas.
Complex layout adaptation: handles scanned docs, irregular formatting, watermark interference, and other complex document scenarios.
File restrictions:

Limitations	Limit
File size limit	200 MB
Max pages per file	600 pages
Supported file types	PDFImage [action] [missing source].png/jpg/jpeg/jp2/webp/gif/bmp),Doc、Docx、Ppt、PPTx
Single file parsing
Create Parsing Task
API Description

Apply for token via API before creating a parsing task. Note:

Single file size cannot exceed 200MB, page count within 600 pages.
Per account per day. 2000 Highest priority page parsing quota exceeded. 2000 Page sections: lower priority.
Due to network restrictions,github、aws Awaiting overseas URL Request will time out.
Endpoint does not support direct file upload.
headerHeader must contain Authorization Field, format: Bearer + Space + Token
Python Request example (forpdf、doc、pptImage files

import requests

token = "Applied for on the official website.api token"
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

token = "api token applied from official website"
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
Request Body Parameters

Parameter	Type	Required?	Example	Description
url	string	Yes	https://static.openxlab.org.cn/
opendatalab/pdf/demo.pdf	File URL, supports .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp), .html multiple formats
is_ocr	bool	No	false	Enable OCR function, default false, only valid for pipeline, vlm models
enable_formula	bool	No	true	Enable formula recognition (default true), only valid for pipeline, vlm models. Note: for vlm, this parameter only affects inline formula parsing.
enable_table	bool	No	true	Enable table recognition (default true), only valid for pipeline, vlm models
language	string	No	ch	Specify document language, default ch; other values list see: https://www.paddleocr.ai/latest/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html#_3, only for pipeline, vlm models
data_id	string	No	abc	Data ID corresponding to parsing object; composed of alphanumeric, underscore, hyphen, period, max 128 chars, uniquely identifies business data.
callback	string	No	http://127.0.0.1/callback	URL for callback notification of parsing results, supports HTTP/HTTPS. If empty, must poll results periodically. Callback must support POST, UTF-8, Content-Type:application/json, and parameters checksum and content. Parsing API sets checksum and content per rules, calls your callback API to return detection results.
checksumString format, user-defined. uid + seed + content Concatenate into string; pass. SHA256 Algorithm generated. User. UIDAvailable in Personal Center. To prevent tampering, when obtaining the push result, generate a string using the above algorithm and compare it with checksum Validate.
content：JSON String format, please parse and reverse it yourself. JSON Object. About. content Result examples: see task query result return example, corresponding to task query result. data Part.
Note: After your server callback receives the parsing result pushed by Mineru, if HTTP status code 200 is returned, it indicates successful reception; other HTTP status codes indicate failure. On failure, mineru will retry up to 5 times until success. After 5 retries, no further push; please check your callback API status.
seed	string	No	abc	Random string used for signature in callback notification requests. Composed of alphanumeric and underscore, max 64 chars, user-defined to verify request origin upon receiving content safety callback notifications initiated by Mineru.
Note: When using callback This field is required.
extra_formats	[string]	No	["docx","html"]	markdown, json are default export formats, no need to set; this parameter only supports one or more of docx, html, latex. Not valid for source files that are html.
page_ranges	string	No	1-600	Specify page range as comma-separated string. Example: "2,4-6" selects page 2, pages 4 to 6 (includes 4 and 6, result [2,4,5,6]); "2--2" indicates selection from page 2 to the second-to-last page (where "-2" represents the second-to-last page).
model_version	string	No	vlm	Mineru model version (3 options): pipeline, vlm, MinerU-HTML, default pipeline. If parsing HTML, must explicitly set to MinerU-HTML; for non-HTML, choose pipeline or vlm.
no_cache	bool	No	false	Bypass cache, default false. API server caches URL content for a period; set true to ignore cached results and get latest content from URL.
cache_tolerance	int	No	900	Cache tolerance time (seconds), default 900 (15 minutes). Tolerable URL content cache TTL; older caches discarded. Valid when no_cache is false.
Response Parameters

Parameter	Type	Example	Description
code	int	0	API status code: success0
msg	string	ok	API info processed, success:"ok"
trace_id	string	c876cd60b202f2396de1f9e39a1b0172	Request ID
data.task_id	string	a90e6ab6-44f3-4554-b459-b62fe4c6b436	Extract tasks idcan be used to query task results
Response Example

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

Query the current progress of the extraction task via task_id; upon completion, the API responds with the corresponding extraction details.

Python Request Example

import requests

token = "api token applied from official website"
task_id = "Task ID returned. task_id"
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

Parameter	Type	Example	Description
code	int	0	API status code, success: 0
msg	string	ok	Interface processing info, success: "ok"
trace_id	string	c876cd60b202f2396de1f9e39a1b0172	Request ID
data.task_id	string	abc	Task ID
data.data_id	string	abc	Data ID corresponding to parsing object.
Note: If passed in request parameters during parsing. data_idthen return corresponding here. data_id。
data.state	string	done	Task processing status: Completed:done，pending: Queuing,running: Parsing...failedParsing failed,convertingConverting format
data.full_zip_url	string	https://cdn-mineru.openxlab.org.cn/
pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip	Parsed Results Archive
For non-html file parsing result details, see: https://opendatalab.github.io/MinerU/reference/output_files/ , omit layout.json for intermediate processing results (middle.json), _model.json for model inference results (model.json), _content_list.json for content list (content_list.json), full.md for Markdown parsing results.

HTML file parsing results differ slightly: full.md for Markdown parsing results, main.html for extracted main content HTML.
data.err_msg	string	File format not supported. Upload a valid file type.	Parsing failure reason, valid when state=failed
data.extract_progress.extracted_pages	int	1	Number of pages parsed, valid when state=running
data.extract_progress.start_time	string	2025-01-20 11:43:20	Document parsing start time, valid when state=running
data.extract_progress.total_pages	int	2	Total document pages, valid when state=running
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
Batch File Upload & Parse
Interface description

For local file upload and parsing scenarios, use this API to batch request upload URLs. After upload, the system automatically submits parsing tasks. Note:

The requested file upload link is valid for 24 Please complete the file upload within the validity period.
Upload file. No settings required. Content-Type Request Headers
After upload completes, no need to call task submission API. System auto-scans uploaded files and auto-submits parsing tasks.
Single application link cannot exceed 200 items
Header must include Authorization field, format Bearer + space + Token
Python request example (for pdf, doc, ppt, image files):

import requests

token = "api token applied from official website"
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

token = "api token applied from official website"
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
CURL File upload example:

curl -X PUT -T /path/to/your/file.pdf 'https://****'
Request body parameter description

Parameter	Type	Required?	Example	Description
enable_formula	bool	No	true	Enable formula recognition, default true, only valid for pipeline and vlm models. Note: for vlm, this only affects inline formula parsing.
enable_table	bool	No	true	Enable table recognition, default true, only valid for pipeline and vlm models.
language	string	否	ch	指定文档语言，默认 ch，其他可选值列表详见：https://www.paddleocr.ai/latest/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html#_3，仅对pipeline、vlm模型有效
file.name	string	Yes	demo.pdf	File name, supports .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp), .html multiple formats. Strongly recommend correct file extension.
file.is_ocr	bool	No	true	Enable OCR function, default false, only valid for pipeline and vlm models.
file.data_id	string	No	abc	Data ID corresponding to parsing object; composed of alphanumeric, underscore, hyphen, period, max 128 chars, can uniquely identify your business data.
file.page_ranges	string	No	1-600	Specify page range as comma-separated string. Example: "2,4-6" selects page 2, pages 4 to 6 (includes 4 and 6, result [2,4,5,6]); "2--2" indicates selection from page 2 to the second-to-last page (where "-2" represents the second-to-last page).
callback	string	No	http://127.0.0.1/callback	URL for callback notification of parsing results, supports HTTP/HTTPS. If empty, must poll results periodically. Callback must support POST, UTF-8, Content-Type:application/json, and parameters checksum and content. Parsing API sets checksum and content per rules, calls your callback API to return detection results.
checksum: string format, generated by SHA256 from user uid + seed + content. User UID can be queried in personal center. To prevent tampering, when receiving push results, generate string using the above algorithm and compare with checksum.
content: JSON string format, parse and reverse to JSON object. See task query result example for content, corresponding to data part of task query result.
Note: After your server callback receives the parsing result pushed by Mineru, if HTTP status code 200 is returned, it indicates successful reception; other HTTP status codes indicate failure. On failure, mineru will retry up to 5 times until success. After 5 retries, no further push; please check your callback API status.
seed	string	No	abc	Random string used for signature in callback notification requests. Composed of alphanumeric and underscore, max 64 chars, user-defined to verify request origin upon receiving content safety callback notifications initiated by Mineru.
Note: When using callback, this field is required.
extra_formats	[string]	No	["docx","html"]	markdown, json are default export formats, no need to set; this parameter only supports one or more of docx, html, latex. Not valid for source files that are html.
model_version	string	No	vlm	Mineru model version, three options: pipeline, vlm, MinerU-HTML, default pipeline. If parsing HTML, must specify MinerU-HTML; for non-HTML, choose pipeline or vlm.
Response parameter description

Parameter	Type	Example	Description
code	int	0	API status code, success: 0
msg	string	ok	Interface processing info, success: "ok"
trace_id	string	c876cd60b202f2396de1f9e39a1b0172	Request ID
data.batch_id	string	2bb2f0ec-a336-4a0a-b61a-****	Batch extraction task idBatch query parsing results
data.file_urls	[string]	["https://mineru.oss-cn-shanghai.aliyuncs.com/api-upload/***"]	File upload link
Response example

{
  "code": 0,
  "data": {
    "batch_id": "2bb2f0ec-a336-4a0a-b61a-241afaf9cc87",
    "file_urls": [
        "https://***"
    ]
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
url Batch Upload Parsing
Interface description

For batch extraction task creation via API. Note:

Single application link cannot exceed 200 items.
File size cannot exceed 200MB, page count not exceeding 600 pages.
Due to network restrictions, github, aws and other overseas URLs will time out.
Header must include Authorization field, format Bearer + space + Token
Python request example (for pdf, doc, ppt, image files):

import requests

token = "api token applied from official website"
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

token = "api token applied from official website"
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

Parameter	Type	Required?	Example	Description
enable_formula	bool	No	true	Enable formula recognition, default true, only valid for pipeline and vlm models. Note: for vlm, this only affects inline formula parsing.
enable_table	bool	No	true	Enable table recognition, default true, only valid for pipeline and vlm models.
language	string	否	ch	指定文档语言，默认 ch，其他可选值列表详见：https://www.paddleocr.ai/latest/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html#_3，仅对pipeline、vlm模型有效
file.url	string	Yes	demo.pdf	Supports file links: .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp, .html multiple formats.
file.is_ocr	bool	No	true	Enable OCR function, default false, only valid for pipeline and vlm models.
file.data_id	string	No	abc	Data ID corresponding to parsing object; composed of alphanumeric, underscore, hyphen, period, max 128 chars, can uniquely identify your business data.
file.page_ranges	string	No	1-600	Specify page range as comma-separated string. Example: "2,4-6" selects page 2, pages 4 to 6 (includes 4 and 6, result [2,4,5,6]); "2--2" indicates selection from page 2 to the second-to-last page (where "-2" represents the second-to-last page).
callback	string	No	http://127.0.0.1/callback	URL for callback notification of parsing results, supports HTTP/HTTPS. If empty, must poll results periodically. Callback must support POST, UTF-8, Content-Type:application/json, and parameters checksum and content. Parsing API sets checksum and content per rules, calls your callback API to return detection results.
checksum: string format, generated by SHA256 from user uid + seed + content. User UID can be queried in personal center. To prevent tampering, when receiving push results, generate string using the above algorithm and compare with checksum.
content: JSON string format, parse and reverse to JSON object. See task query result example for content, corresponding to data part of task query result.
Note: After your server callback receives the parsing result pushed by Mineru, if HTTP status code 200 is returned, it indicates successful reception; other HTTP status codes indicate failure. On failure, mineru will retry up to 5 times until success. After 5 retries, no further push; please check your callback API status.
seed	string	No	abc	Random string used for signature in callback notification requests. Composed of alphanumeric and underscore, max 64 chars, user-defined to verify request origin upon receiving content safety callback notifications initiated by Mineru.
Note: When using callback, this field is required.
extra_formats	[string]	No	["docx","html"]	markdown, json are default export formats, no need to set; this parameter only supports one or more of docx, html, latex. Not valid for source files that are html.
model_version	string	No	vlm	Mineru model version, three options: pipeline, vlm, MinerU-HTML, default pipeline. If parsing HTML, must specify MinerU-HTML; for non-HTML, choose pipeline or vlm.
no_cache	bool	No	false	Bypass cache, default false. API server caches URL content for a period; set true to ignore cached results and get latest content from URL.
cache_tolerance	int	No	900	Cache tolerance time (seconds), default 900 (15 minutes). Tolerable URL content cache TTL; older caches discarded. Valid when no_cache is false.
Request Body Example

{
    "files": [
        {"url":"https://cdn-mineru.openxlab.org.cn/demo/example.pdf", "data_id": "abcd"}
    ],
    "model_version": "vlm"
}
Response parameter description

Parameter	Type	Example	Description
code	int	0	API status code, success: 0
msg	string	ok	Interface processing info, success: "ok"
trace_id	string	c876cd60b202f2396de1f9e39a1b0172	Request ID
data.batch_id	string	2bb2f0ec-a336-4a0a-b61a-*	Batch extraction task id, can be used to query batch parsing results
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

Query extraction task progress via batch_id.

Python request example

import requests

token = "api token applied from official website"
batch_id = "Batch commit returns batch_id"
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

Parameter	Type	Example	Description
code	int	0	API status code, success: 0
msg	string	ok	Interface processing info, success: "ok"
trace_id	string	c876cd60b202f2396de1f9e39a1b0172	Request ID
data.batch_id	string	2bb2f0ec-a336-4a0a-b61a-241afaf9cc87	batch_id
data.extract_result.file_name	string	demo.pdf	File name
data.extract_result.state	string	done	Task processing status: done (completed), waiting-file (upload queued, parsing pending), pending (queuing), running (parsing), failed, converting (format conversion)
data.extract_result.full_zip_url	string	https://cdn-mineru.openxlab.org.cn/pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip	File parsing result zip archive
For non-html file parsing result details, see: https://opendatalab.github.io/MinerU/reference/output_files/ , where layout.json corresponds to intermediate processing results (middle.json), **_model.json to model inference results (model.json), _content_list.json to content list (content_list.json), full.md to Markdown parsing results.

HTML file parsing results differ slightly: full.md for Markdown parsing results, main.html for extracted main content HTML.
data.extract_result.err_msg	string	File format not supported, upload a valid file type	Failure reason, valid when state=failed
data.extract_result.data_id	string	abc**	Data ID of the parsed object.
Note: If data_id is provided in the parse request, the corresponding data_id is returned here.
data.extract_result.extract_progress.extracted_pages	int	1	Number of pages parsed, valid when state=running.
data.extract_result.extract_progress.start_time	string	2025-01-20 11:43:20	Document parse start time, valid when state=running.
data.extract_result.extract_progress.total_pages	int	2	Total document pages, valid when state=running.
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
        "file_name":"demo.pdf",
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
Common Error Codes
Error code	Description	Resolution
A0202	Token error	Check if Token is correct, ensure Bearer prefix exists or replace with new Token
A0211	Token Expired	Replace with new Token
-500	Invalid parameter	Ensure parameter type and Content-Type are correct
-10001	Service error.	Try again later
-10002	Invalid request parameter.	Check request parameter format
-60001	Generate & Upload URL Failed, please try again later.	Try again later.
-60002	Failed to get matching file format.	File type error. Ensure filename and link have correct extension and file is one of: pdf, doc, docx, ppt, pptx, png, jpg, jpeg.
-60003	File read failed.	Check if file is corrupted and re-upload.
-60004	Empty file	Upload a valid file.
-60005	File size exceeds limit.	Check file size, max 200MB.
-60006	Page count exceeds limit	Split file and retry.
-60007	Model service temporarily unavailable.	Retry later or contact support.
-60008	File read timeout	Check URL accessibility.
-60009	Task submission queue full	Try again later
-60010	Parsing failed	Try again later
-60011	Failed to get valid file	Ensure file uploaded
-60012	Task not found	Ensure task_id valid and not deleted
-60013	No permission to access this task	Only access your own tasks
-60014	Delete running task	Cannot delete running tasks
-60015	File conversion failed.	Convert to PDF manually then upload
-60016	File conversion failed	Failed to convert to target format, try other formats or retry
-60017	Maximum retries exceeded.	Retry after model upgrade
-60018	Daily parsing task limit reached.	Try again tomorrow
-60019	htmlInsufficient file parsing quota.	Try again tomorrow
-60020	File split failed.	Try again later
-60021	Failed to read file page count.	Try again later
-60022	Failed to load page.	May be network or rate limit issue, try again later
