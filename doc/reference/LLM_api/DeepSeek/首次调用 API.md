DeepSeek API uses OpenAI/Anthropic-compatible API format: modify configuration to use OpenAI/Anthropic SDK to access DeepSeek API, or use with OpenAI/Anthropic API compatible software.

PARAM	VALUE
base_url (OpenAI)	https://api.deepseek.com
base_url (Anthropic)	https://api.deepseek.com/anthropic
api_key	apply for an API key
model*	deepseek-v4-flash
deepseek-v4-pro
deepseek-chat (will 2026/07/24 Deprecated)
deepseek-reasoner (deprecated on 2026/07/24)
* deepseek-chat and deepseek-reasoner two model names will be deprecated on 2026/07/24. For compatibility, each maps to deepseek-v4-flash non-thinking and thinking modes.

Call Conversation API
Creating API key Afterward, you can use the following sample script to via OpenAI API Access by format DeepSeek Model. Sample is non-streaming output; you can stream Set as true Use streaming output.

Anthropic API Refer to format access examples.Anthropic API。

curl
python
nodejs
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
        "model": "deepseek-v4-pro",
        "messages": [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": "Hello!"}
        ],
        "thinking": {"type": "enabled"},
        "reasoning_effort": "high",
        "stream": false
      }'