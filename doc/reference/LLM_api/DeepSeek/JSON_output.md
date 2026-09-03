In many scenarios, users need the model to strictly follow JSON Format output for structure, enabling parsing by subsequent logic.

DeepSeek provides JSON Output Ensures valid model output. JSON String.

Notes
Set response_format parameter: {'type': 'json_object'}.
User-provided system or user prompt must contain wording about json, and provide desired model output JSON format samples to guide model output validity. JSON.
Configure appropriately. max_tokens Parameters, Prevent JSON String truncated partway.
In use JSON Output When the feature,API May return empty with probability. contentWe are actively optimizing this issue. You can try modifying it. prompt To mitigate such issues.
Sample code
Shows usage JSON Output Functional completeness Python Code:

import json
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

system_prompt = """
The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format. 

EXAMPLE INPUT: 
Which is the highest mountain in the world? Mount Everest.

EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}
"""

user_prompt = "Which is the longest river in the world? The Nile River."

messages = [{"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    response_format={
        'type': 'json_object'
    }
)

print(json.loads(response.choices[0].message.content))


The model will output:

{
    "question": "Which is the longest river in the world?",
    "answer": "The Nile River"
}