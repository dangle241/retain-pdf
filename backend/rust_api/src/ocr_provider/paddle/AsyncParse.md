# PaddleOCR-VL-1.5 Service deployment call examples and API Introduction:

> 
> 
> 
> [PaddleOCR open-source project GitHub address](https://github.com/PaddlePaddle/PaddleOCR/tree/release/3.3). Service main file **based on this open-source project: PaddleOCR-VL model building**.
> 
> **Release Notes**: PaddleOCR currently corresponds to the official website **PaddleX version 3.4.0**, **PaddlePaddle version 3.2.1**.
> 

## 1. PaddleOCR-VL-1.5 Introduction

2026year1Month29Day, we arePaddleOCR-VLreleased on the basis of**PaddleOCR-VL-1.5**。PaddleOCR-VL-1.5Not only94.5%Accuracy significantly refreshed on evaluation set.OmniDocBench v1.5Shape-aware bounding box positioning supported.PaddleOCR-VL-1.5 Excels in real-world scenarios: scanning, skewing, bending, screen capture, complex lighting. Adds seal recognition and text detection/recognition. Key metrics lead.

### Key metrics:

![](https://paddle-model-ecology.bj.bcebos.com/paddlex/demo_image/paddleocr-vl-1.5_metrics.png)

Image shows diagram. PaddleOCR-VL-1.5 overall process and new capabilities:

![](https://paddle-model-ecology.bj.bcebos.com/paddlex/demo_image/PaddleOCR-VL-1.5.png)

## 2. API docs

Please check [documentation](https://ai.baidu.com/ai-doc/AISTUDIO/Xmjclapam)

## 3. Service call example (python）

```
# Please make sure the requests library is installed
# pip install requests
import base64
import os
import requests

# API_URL and TOKEN: Visit [PaddleOCR official website](https://aistudio.baidu.com/paddleocr/task) to obtain from the API call examples.
API_URL = "<your url>"
TOKEN = "<access token>"

file_path = "<local file path>"

with open(file_path, "rb") as file:
    file_bytes = file.read()
    file_data = base64.b64encode(file_bytes).decode("ascii")

headers = {
    "Authorization": f"token {TOKEN}",
    "Content-Type": "application/json"
}

required_payload = {
    "file": file_data,
    "fileType": <file type>,  # For PDF documents, set `fileType` to 0; for images, set `fileType` to 1
}

optional_payload = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useChartRecognition": False,
}

payload = {**required_payload, **optional_payload}

response = requests.post(API_URL, json=payload, headers=headers)
print(response.status_code)
assert response.status_code == 200
result = response.json()["result"]

output_dir = "output"
os.makedirs(output_dir, exist_ok=True)

for i, res in enumerate(result["layoutParsingResults"]):
    md_filename = os.path.join(output_dir, f"doc_{i}.md")
    with open(md_filename, "w", encoding="utf-8") as md_file:
        md_file.write(res["markdown"]["text"])
    print(f"Markdown document saved at {md_filename}")
    for img_path, img in res["markdown"]["images"].items():
        full_img_path = os.path.join(output_dir, img_path)
        os.makedirs(os.path.dirname(full_img_path), exist_ok=True)
        img_bytes = requests.get(img).content
        with open(full_img_path, "wb") as img_file:
            img_file.write(img_bytes)
        print(f"Image saved to: {full_img_path}")
    for img_name, img in res["outputImages"].items():
        img_response = requests.get(img)
        if img_response.status_code == 200:
            # Save image to local
            filename = os.path.join(output_dir, f"{img_name}_{i}.jpg")
            with open(filename, "wb") as f:
                f.write(img_response.content)
            print(f"Image saved to: {filename}")
        else:
            print(f"Failed to download image, status code: {img_response.status_code}")
```

Main service operations:

- HTTPRequest method:POST。
- Both request and response bodies areJSONData (JSONObject).
- On successful request processing, response status code is`200`Response body properties:

| Name | Type | Description |
| --- | --- | --- |
| `logId` | `string` | RequestedUUID。 |
| `errorCode` | `integer` | Error code. Fixed as`0`。 |
| `errorMsg` | `string` | Error description. Fixed as.`"Success"`。 |
| `result` | `object` | Operation result. |
- When request processing is unsuccessful, the response body has the following properties:

| Name | Type | Meaning |
| --- | --- | --- |
| `logId` | `string` | Request UUID. |
| `errorCode` | `integer` | Error code. Same as the response status code. |
| `errorMsg` | `string` | Error description. |

Primary service operations:

- **`infer`**

Perform layout analysis.

`POST /layout-parsing`

## 4. Request Parameter Description

| Name | Parameter | Type | Description | Required? |
| --- | --- | --- | --- | --- |
| `Input file` | `file` | `string` | Server-accessible image file or PDF file URL or Base64-encoded content of above file types. Default for PDF files exceeding 100 pages: only first 100 pages processed. Remove page limit: add the following config to production config file:

`Serving:
  extra:
    max_num_input_imgs: null`
| Yes |
| `File type` | `fileType` | `integer`ï½`null` | File type. `0` for PDF, `1` for image. If missing, inferred from URL. | Optional |
| `Image orientation correction` | `useDocOrientationClassify` | `boolean` | `null` | Enable text image orientation correction during inference? If enabled, auto-detects and corrects 0Â°, 90Â°, 180Â°, 270Â° images. | No |
| `Image distortion correction` | `useDocUnwarping` | `boolean` | `null` | Enable text image rectification during inference. When enabled, automatically corrects distorted images (wrinkles, skew). | No |
| `Layout analysis` | `useLayoutDetection` | `boolean` | `null` | Enable layout region detection and sorting module during inference. When enabled, detects and sorts different document regions automatically. | No |
| `Chart recognition` | `useChartRecognition` | `boolean` | `null` | Enable chart parsing during inference. When enabled, parses charts (bar, pie, etc.) in documents and converts to tables for easy viewing and data editing. | No |
| `Layout region filter threshold` | `layoutThreshold` | `number` | `object` | `null` | Layout model score threshold, any float between 0â1. If unset, uses production-line initialized value; default 0.5. | No |
| `NMS post-processing` | `layoutNms` | `boolean` | `null` | Use NMS for layout detection post-processing? When enabled, automatically removes duplicate or heavily overlapping region boxes. | No |
| `Expansion coefficient` | `layoutUnclipRatio` | `number` | `array` | `object` | `null` | Expansion coefficient for bounding boxes from layout detection model. Any float >0. If unset, uses production-initialized parameter value; default 1.0. | No |
| `Overlapping Box Filtering for Layout Region Detection` | `layoutMergeBboxesMode` | `string` | `object` | `null` |  
• **large**Set tolargeWhen set, retain only the largest outer bounding box among overlapping boxes in model output; discard inner overlaps. 
â¢ **small** â set to small to keep only inner boxes among overlapping boxes, delete outer overlaps.
• **union**No box filtering. Keep both inner and outer boxes.  If unset, uses production-initialized value. Defaults to`large`。 | No |
| `Layout detection result geometry` | `layoutShapeMode` | `string` | `null` | Specifies geometric representation mode for layout detection results. Determines how boundaries of detected regions (text blocks, images, tables, etc.) are computed and displayed. Acceptable values: `rect`, `quad`, `poly`, `auto`; default initialized to `auto`. | No |
| `prompt type setting` | `promptLabel` | `string` | `null` | VL model's prompt type, effective only when `useLayoutDetection=False`. Fillable: `ocr`, `formula`, `table`, `chart`; default initialized to `ocr`. | Optional |
| `Repetition suppression strength` | `repetitionPenalty` | `number` | `null` | If duplicate text or table content appears in results, increase accordingly. | No |
| `Recognition stability` | `temperature` | `number` | `null` | Lower when results unstable or hallucinating; raise slightly for frequent misses or duplicates. | No |
| `Result confidence range` | `topP` | `number` | `null` | Lower appropriately when results are divergent or insufficiently credible to make model more conservative. | No |
| `Minimum image size` | `minPixels` | `number` | `null` | Increase if input image too small or text illegible; usually no adjustment. | No |
| `Max image size` | `maxPixels` | `number` | `null` | If input image very large, slows processing or high GPU memory pressure; reduce appropriately. | No |
| `Formula number display` | `showFormulaNumber` | `boolean` | Whether output Markdown text includes equation numbers. | No |
| `Refactor multi-page results` | `restructurePages` | `boolean` | Refactor multi-page PDF parse results, adapt cross-page table merging and paragraph heading level recognition; default initialized to `False`. | No |
| `Cross-page table merge` | `mergeTables` | `boolean` | When enabled, identifies cross-page tables and merges them into one; effective only when `useLayoutDetection=False`; default initialized to `True`. | No |
| `Heading level detection` | `relevelTitles` | `boolean` | When enabled, identifies paragraph heading levels, if and only if `useLayoutDetection=False` Takes effect when, default initialized to`True`。 | whether |
| `Markdown prettify` | `prettifyMarkdown` | `boolean` | Output prettified Markdown text? | No |
| `Visualize` | `visualize` | `boolean` | `null` | Supports returning visualization result charts and intermediate images during processing. Enabling this increases result return time.
• Input `true`Return image. 
â¢ Pass `false` to not return images.
• If the parameter is not provided in the request body or passed in `null`Follow production line configuration file.`Serving.visualize` settings.  Example: add fields to production config: 

`Serving:
  visualize: False`
By default, images are not returned; request body `visualize` overrides default. If neither request body nor config sets it (or request body passes `null`), default is to return image if no config set. | No |
- On successful request, response body`result`Has the following properties:

| Name | Type | Meaning |
| --- | --- | --- |
| `layoutParsingResults` | `array` | Layout parsing results. Array length 1 for image input, or number of actually processed pages for PDF. For PDF, each element sequentially represents each processed page's result. |
| `dataInfo` | `object` | Enter data information. |

`layoutParsingResults`Each element is a`object`Has the following properties:

| Name | Type | Meaning |
| --- | --- | --- |
| `prunedResult` | `object` | Object's `predict` method results JSON, simplified version of `res` field, with `input_path` and `page_index` removed. |
| `markdown` | `object` | MarkdownResult. |
| `outputImages` | `object` | `null` | See prediction results. `img` Attribute description. The image isJPEGformat, usingBase64Encoding. |
| `inputImage` | `string` | `null` | Input image. Image is JPEG format, Base64-encoded. |

`markdown` is an `object` with the following properties:

| Name | Type | Meaning |
| --- | --- | --- |
| `text` | `string` | MarkdownText. |
| `images` | `object` | MarkdownImage relative path andBase64Encoded image key-value pairs. |
- **`restructurePages`**

Refactor multi-page results (optional).

`POST /restructure-pages`

- Request body properties:

| Name | Parameter | Type | Meaning | Required? |
| --- | --- | --- | --- | --- |
| `Cross-page table merge` | `mergeTables` | `boolean` | When enabled, identifies cross-page tables and merges them into one; effective only when `useLayoutDetection=False`; default initialized to `True`. | No |
| `Paragraph heading level recognition` | `relevelTitles` | `boolean` | When enabled, identifies paragraph heading levels; effective only when `useLayoutDetection=False`; default initialized to `True`. | No |
| `Refactor multi-page results` | `concatenatePages` | `boolean` | Refactor multi-page PDF parse results to adapt cross-page table merging and paragraph heading level recognition; default initialized to `False`. | No |
| `Markdown prettify` | `prettifyMarkdown` | `boolean` | Output prettified Markdown text? | No |
| `Formula number display` | `showFormulaNumber` | `boolean` | Whether output Markdown text includes equation numbers. | No |

Each element in `pages` is an `object` with the following properties:

| Name | Type | Meaning |
| --- | --- | --- |
| `prunedResult` | `object` | Corresponds to `prunedResult` object from `infer` return value. |
| `markdownImages` | `object`|`null` | Corresponds to the `markdown` object's `images` property from `infer` operation. |
- On successful request, response body `result` has the following properties:

| Name | Type | Meaning |
| --- | --- | --- |
| `layoutParsingResults` | `array` | Refactored layout parsing results. Each element contains fields as described for the `infer` operation result (excluding visualization result images and intermediate images). |

See return data structure and field descriptions.[文档](https://www.paddleocr.ai/latest/version3.x/pipeline_usage/PaddleOCR-VL.html)。

**Note**If you encounter any issues during use, feel free to [issue](https://github.com/PaddlePaddle/PaddleOCR/issues) Submit feedback.

# Async call code

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = "<PADDLEOCR_API_TOKEN>"
MODEL = "PaddleOCR-VL"

file_path = "<local file path or file url>"

headers = {
    "Authorization": f"bearer {TOKEN}",
}

optional_payload = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useChartRecognition": False,
}

print(f"Processing file: {file_path}")

if file_path.startswith("http"):
    # URL Mode
    headers["Content-Type"] = "application/json"
    payload = {
        "fileUrl": file_path,
        "model": MODEL,
        "optionalPayload": optional_payload
    }
    job_response = requests.post(JOB_URL, json=payload, headers=headers)
else:
    # Local File Mode
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        sys.exit(1)
        
    data = {
        "model": MODEL,
        "optionalPayload": json.dumps(optional_payload)
    }
    
    with open(file_path, "rb") as f:
        files = {"file": f}
        job_response = requests.post(JOB_URL, headers=headers, data=data, files=files)

print(f"Response status: {job_response.status_code}")
if job_response.status_code != 200:
    print(f"Response content: {job_response.text}")

assert job_response.status_code == 200
jobId = job_response.json()["data"]["jobId"]
print(f"Job submitted successfully. job id: {jobId}")
print("Start polling for results")

jsonl_url = ""
while True:
    job_result_response = requests.get(f"{JOB_URL}/{jobId}", headers=headers)
    assert job_result_response.status_code == 200
    state = job_result_response.json()["data"]["state"]
    if state == 'pending':
        print("The current status of the job is pending")
    elif state == 'running':
        try:
            total_pages = job_result_response.json()['data']['extractProgress']['totalPages']
            extracted_pages = job_result_response.json()['data']['extractProgress']['extractedPages']
            print(f"The current status of the job is running, total pages: {total_pages}, extracted pages: {extracted_pages}")
        except KeyError:
             print("The current status of the job is running...")
    elif state == 'done':
        extracted_pages = job_result_response.json()['data']['extractProgress']['extractedPages']
        start_time = job_result_response.json()['data']['extractProgress']['startTime']
        end_time = job_result_response.json()['data']['extractProgress']['endTime']
        print(f"Job completed, successfully extracted pages: {extracted_pages}, start time: {start_time}, end time: {end_time}")
        jsonl_url = job_result_response.json()['data']['resultUrl']['jsonUrl']
        break
    elif state == "failed":
        error_msg = job_result_response.json()['data']['errorMsg']
        print(f"Job failed, failure reason：{error_msg}")
        sys.exit()

    time.sleep(5)

if jsonl_url:
    jsonl_response = requests.get(jsonl_url)
    jsonl_response.raise_for_status()
    lines = jsonl_response.text.strip().split('\n')
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    page_num = 0
    for line_num, line in enumerate(lines, start=1):
        line = line.strip()
        if not line:
            continue
        result = json.loads(line)["result"]
        for i, res in enumerate(result["layoutParsingResults"]):
            md_filename = os.path.join(output_dir, f"doc_{page_num}.md")
            with open(md_filename, "w", encoding="utf-8") as md_file:
                md_file.write(res["markdown"]["text"])
            print(f"Markdown document saved at {md_filename}")
            for img_path, img in res["markdown"]["images"].items():
                full_img_path = os.path.join(output_dir, img_path)
                os.makedirs(os.path.dirname(full_img_path), exist_ok=True)
                img_bytes = requests.get(img).content
                with open(full_img_path, "wb") as img_file:
                    img_file.write(img_bytes)
                print(f"Image saved to: {full_img_path}")
            for img_name, img in res["outputImages"].items():
                img_response = requests.get(img)
                if img_response.status_code == 200:
                    # Save image to local
                    filename = os.path.join(output_dir, f"{img_name}_{page_num}.jpg")
                    with open(filename, "wb") as f:
                        f.write(img_response.content)
                    print(f"Image saved to: {filename}")
                else:
                    print(f"Failed to download image, status code: {img_response.status_code}")
            page_num += 1