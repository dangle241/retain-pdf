Async API User Guide
Last updated:2026-02-04
Async API User Guide
Max 1000 page PDF per request
Supports file link input. File size cannot exceed 200 MB
Supports uploading local files. File size cannot exceed 50 MB
Async API Complete call example
Response fields vary by model. Provided separately below. PaddleOCR-VL series / PP-StructureV3 and PP-OCRv5 Call example.

1. PaddleOCR-VL-1.5、PaddleOCR-VL、PP-StructureV3 Example
Applies to PaddleOCR-VL-1.5, PaddleOCR-VL and PP-StructureV3 models.

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = ""
# Optional models: "PaddleOCR-VL-1.5", "PaddleOCR-VL", "PP-StructureV3"
MODEL = "PaddleOCR-VL-1.5"

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
# Note: Uses layoutParsingResults field
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
2. PP-OCRv5 Call Example
Applicable to PP-OCRv5 model.

# Please make sure the requests library is installed
# pip install requests
import json
import os
import requests
import sys
import time

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = ""
MODEL = "PP-OCRv5"

file_path = "<local file path or file url>"

headers = {
    "Authorization": f"bearer {TOKEN}",
}

optional_payload = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useTextlineOrientation": False,
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
# Note: PP-OCRv5 uses ocrResults field
        for i, res in enumerate(result["ocrResults"]):
            image_url = res["ocrImage"]
            img_response = requests.get(image_url)
            if img_response.status_code == 200:
                # Save image to local
                filename = f"output/img_output_{page_num}.jpg"
                with open(filename, "wb") as f:
                    f.write(img_response.content)
                print(f"Image saved to: {filename}")
            else:
                print(f"Failed to download image, status code: {img_response.status_code}")
            page_num += 1
API Documentation
Base URL：https://paddleocr.aistudio-app.com/

Submit parsing task
Path: /api/v2/ocr/jobs

Method: POST

Header:

Authorization: Bearer {access_token}
Content-Type: application/jsonSet when file link passed; sample code auto-adapts.
Content-Type: multipart/form-data(Set when uploading files; automatically adapted in sample code.)
Accept-Encoding: gzip, deflate, br
Request Parameters
Parameter	Type	Required	Example	Description
file	bytes	Yes (with fileUrl Select one of two)		Binary file data
fileUrl	string	Yes (choose one of file or fileUrl)		File link
model	string	Yes	PP-OCRv5
PP-StructureV3
PaddleOCR-VL
PaddleOCR-VL-1.5	OCR DeepSeek
optionalPayload	object	No	{"useDocOrientationClassify": false}	Parse parameters. Vary by model type. Reference:
PP-OCRV5Source text missing. Provide content to translate.
PP-StructureV3: Documentation
PaddleOCR-VL: Documentation
PaddleOCR-VL-1.5: Documentation
pageRanges	string	No	"2,4-6" Page 2, Pages 4-6
"2--2": Page 2 to second to last page	Specify page range to parse
batchId	string	No	Unique identifier string	Batch ID used for batch query tasks
Response Parameter Description
Parameter	Type	Example	Description
traceId	string	0b1eb3150f5bec03dab9e74b4264c615	Request ID
code	int	10002	API status code: success is 0For failure details, refer to "Error Code Description".
msg	string	File URL Unrecognized	API response information. For failure details, refer to the "Error Code Description".
data	object		
data.jobId	string	ocrjob-f4377241b695	Job ID
Get parse result
Path: /api/v2/ocr/jobs/{jobId}

Method: GET

Header:

Authorization: Bearer {access_token}
Content-Type: application/json
Response Parameter Description
Parameter	Type	Example	Description
traceId	string	0b1eb3150f5bec03dab9e74b4264c615	Request ID
code	int	0	Interface status code, success: 0
msg	string	Success	Interface processing info, success: "Success"
data	object		
data.jobId	string	ocrjob-f4377241b695	Job ID
data.state	string	done	Task Processing Status
* donedone
* pendingpending
* runningParsing
* failedParsing failed (no partial success)
data.errorMsg	string	Unsupported file format, please upload a required file type	Parse failure reason state=failed The value is valid at that time.
data.resultUrl	object	Provides BOS Short link
{ "jsonUrl": "https://***.com", "markdownUrl": "https://***.com"}	Document parsing result state=done Value valid at this time.
data.extractProgress	object		Parsing progress valid when state=running
data.extractProgress.startTime	string	2026-01-01T12:00:00+08:00	Document parsing start time
data.extractProgress.endTime	string	2026-01-01T12:00:00+08:00	Document parsing end time
data.extractProgress.totalPages	string	10	Total Pages
data.extractProgress.extractedPages	string	1	Pages parsed
Batch get job results
Path: /api/v2/ocr/jobs/batch/{batchId}

Method: GET

Header:

Authorization: Bearer {access_token}
Content-Type: application/json
Accept-Encoding: gzip, deflate, br
Response parameter description

Parameter	Type	Example	Description
traceId	string	0b1eb3150f5bec03dab9e74b4264c615	Request ID
code	int	0	Interface status code, success: 0
msg	string	Success	Interface processing info, success: "Success"
data	object		
data.batchId	string	batchid-202601210000	Batch Tasks IDUser-defined input, form customizable.
data.extractResult	array		Inference Results List
data.extractResult.jobId	string	ocrjob-f4377241b695	Job ID
data.extractResult.state	string	done	Job processing status
* done: completed
* pending: queuing
* running: parsing
* failed: parsing failed (no partial page success)
data.extractResult.errorMsg	string	Unsupported file format, please upload a required file type	Parse failure reason valid when state=failed
data.extractResult.resultUrl	object	Provides BOS short link
{ "jsonUrl": "https://***.com", "markdownUrl": "https://***.com"}	Document parsing result valid when state=done
data.extractResult.extractProgress	object		Document parsing progress valid when state=running
data.extractResult.extractProgress.startTime	string	2026-01-01T12:00:00+08:00	Document parsing start time
data.extractResult.extractProgress.endTime	string	2026-01-01T12:00:00+08:00	Document parsing end time
data.extractResult.extractProgress.totalPages	int	10	Total document pages
data.extractResult.extractProgress.extractedPages	int	1	Parsed document pages
