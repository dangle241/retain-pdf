Access Claude Code
Install Claude Code
npm install -g @anthropic-ai/claude-code

Configure environment variables.
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN=${DEEPSEEK_API_KEY}
export ANTHROPIC_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK=1
export CLAUDE_CODE_EFFORT_LEVEL=max

Navigate to the project directory and run. claude Run the command to start.
cd my-project
claude


Access OpenCode
Install OpenCode
See installation instructions.OpenCode Official Documentation

Modify configuration file.
Add the following to your configuration file. provider Configuration. Configuration file path:~/.config/opencode/opencode.jsonc

  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "<DeepSeek API Key>"
      },
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek-V4-Pro",
          "limit": {
            "context": 1048576,
            "output": 262144
          },
          "options": {
            "reasoningEffort": "max",
            "thinking": {
              "type": "enabled"
            }
          }
        }
      }
    }
  }