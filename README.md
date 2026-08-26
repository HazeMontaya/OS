# OS — portable AI desktop runtime

OS is built as a self-contained Windows desktop folder. There is no installer and no start script in the distribution.

## Run
1. Download/extract `OS-Windows-x64.zip`.
2. Open the extracted `OS` folder.
3. Double-click `OS.exe`.

`OS.exe` includes the Electron/Node runtime required to start the local OS core. The portable root contains `Core`, `Config`, `Workspace`, `AI-Brain`, `Models`, `Data` and `Logs` beside the executable/runtime files.

## AI providers
OS uses a generic provider layer instead of hard-coding three CLIs. Supported transports include OpenAI-compatible APIs, Anthropic Messages API and optional CLI adapters. The current model catalog lives at `Config/OS/models.json` and includes OpenAI GPT-5.6, Claude 5, Gemini 3.7, Grok 4.6, DeepSeek V4, GLM 5.3, Kimi K3, MiniMax M3, MiMo V2.5, NVIDIA Nemotron 3 Ultra plus tracked local/open-weight models from Qwen and Gemma.

API credentials are read from environment variables configured in `Config/OS/runtime.json`; secrets are never committed into the portable root.

## Build
GitHub Actions assembles `OS-Windows-x64.zip` from the official Electron Windows x64 runtime and this repository. A tagged `v*` build creates a GitHub Release automatically.

## Source layout
- `Core/Desktop` — secure Electron shell
- `Core/Runtime` — local OS API/agent runtime
- `Core/UI` — application UI
- `Config/OS` — runtime and model catalog
- `Workspace` — agents, workflows, automations, MCP
- `AI-Brain` — knowledge/operating instructions
- `Models` — local model/inference assets
