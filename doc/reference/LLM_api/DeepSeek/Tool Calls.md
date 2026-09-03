Tool Calls Enable models to call external tools to enhance their capabilities.

Non-thinking mode
Sample code
This uses obtaining the user's current location weather information as an example, demonstrating the complete Python code using Tool Calls.

Tool Calls Specific API Refer to the Chat Completion documentation for formatting.

from openai import OpenAI

def send_messages(messages):
    response = client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=messages,
        tools=tools
    )
    return response.choices[0].message

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply a location first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    }
                },
                "required": ["location"]
            },
        }
    },
]

messages = [{"role": "user", "content": "How's the weather in Hangzhou, Zhejiang?"}]
message = send_messages(messages)
print(f"User>\t {messages[0]['content']}")

tool = message.tool_calls[0]
messages.append(message)

messages.append({"role": "tool", "tool_call_id": tool.id, "content": "24℃"})
message = send_messages(messages)
print(f"Model>\t {message.content}")

Execution flow for this example:

User: asks about the current weather
Model: Return function get_weather({location: 'Hangzhou'})
User: Call function get_weather({location: 'Hangzhou'})and pass to the model.
Model: returns natural language,"The current temperature in Hangzhou is 24°C."
Note: in the above code get_weather User provides function implementation; model does not execute.

Thinking mode
Starting from DeepSeek-V3.2, API added support for tool calling in thinking mode. See Thinking Mode for details.

strict Mode (Beta）
In strict mode, the model outputting Function strictly follows Function's JSON Schema format requirements to ensure the model outputs Function that meets user definition. Tool calls allowed in both thinking and non-thinking modes. strict mode.

Use strict Mode, required:

User configuration required. base_url="https://api.deepseek.com/beta" Enable Beta Feature
In the passed tools All in the list function All required. strict Attribute: true
The server validates the user-provided Function's JSON Schema; if not compliant, or if the server does not support the JSON Schema type, returns error message.
Below is strict Mode tool Definition examples:

{
    "type": "function",
    "function": {
        "name": "get_weather",
        "strict": true,
        "description": "Get weather of a location, the user should supply a location first.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                }
            },
            "required": ["location"],
            "additionalProperties": false
        }
    }
}

strict supported JSON Schema types
object
string
number
integer
boolean
array
enum
anyOf
object type
object defines a deep structure containing key-value pairs, where properties defines each key (property) in the object's schema. Each object property must be set to required, and additionalProperties attribute must be false.

Example:

{
    "type": "object",
    "properties": {
        "name": { "type": "string" },
        "age": { "type": "integer" }
    },
    "required": ["name", "age"],
    "additionalProperties": false
}

string type
Parameters:
patternUse regular expressions to constrain string format.
formatValidate using predefined common formats. Currently supported:
emailEmail address
hostnameHostname
ipv4：IPv4 Address
ipv6: IPv6 address
uuid：uuid
Unsupported parameter
minLength
maxLength
Example:

{
    "type": "object",
    "properties": {
        "user_email": {
            "type": "string",
            "description": "The user's email address",
            "format": "email" 
        },
        "zip_code": {
            "type": "string",
            "description": "Six digit postal code",
            "pattern": "^\\d{6}$"
        }
    }
}

number/integer type
Supported parameters
constFixed numbers as constants.
defaultDefault value
minimumMinimum
maximumMaximum
exclusiveMinimumNot less than
exclusiveMaximumnot greater than
multipleOfNumber output is a multiple of this value.
Example:

{
    "type": "object",
    "properties": {
        "score": {
            "type": "integer",
            "description": "A number from 1-5, which represents your rating, the higher, the better",
            "minimum": 1,
            "maximum": 5
        }
    },
    "required": ["score"],
    "additionalProperties": false
}

array type
Unsupported parameters
minItems
maxItems
Example:

{
    "type": "object",
    "properties": {
        "keywords": {
            "type": "array",
            "description": "Five keywords of the article, sorted by importance",
            "items": {
                "type": "string",
                "description": "A concise and accurate keyword or phrase."
            }
        }
    },
    "required": ["keywords"],
    "additionalProperties": false
}

enum
enum Ensures output is one of the expected options, e.g., order status restricted to a finite set.

Example:

{
    "type": "object",
    "properties": {
        "order_status": {
            "type": "string",
            "description": "Ordering status",
            "enum": ["pending", "processing", "shipped", "cancelled"]
        }
    }
}

anyOf
Match the provided multiple. schema Handle multiple valid formats per field. Use union type or pattern match. Example: `Account = Email | Phone`.

{
    "type": "object",
    "properties": {
    "account": {
        "anyOf": [
            { "type": "string", "format": "email", "description": "Can be an email address." },
{ "type": "string", "pattern": "^\\d{11}
        ]
    }
  }
}

$ref 和 $def
can use $def Define module, then use. $ref Reference to reduce pattern repetition and modularize; also usable standalone. $ref Define recursive structure.

{
    "type": "object",
    "properties": {
        "report_date": {
            "type": "string",
            "description": "The date when the report was published"
        },
        "authors": {
            "type": "array",
            "description": "The authors of the report",
            "items": {
                "$ref": "#/$def/author"
            }
        }
    },
    "required": ["report_date", "authors"],
    "additionalProperties": false,
    "$def": {
        "authors": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "author's name"
                },
                "institution": {
                    "type": "string",
                    "description": "author's institution"
                },
                "email": {
                    "type": "string",
                    "format": "email",
                    "description": "author's email"
                }
            },
            "additionalProperties": false,
            "required": ["name", "institution", "email"]
        }
    }
}

Previous page