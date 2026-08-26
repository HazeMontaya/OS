# AI model landscape — 2026-08-26

OS tracks model families by capability rather than locking its architecture to one vendor. Current high-interest families include GPT-5.6 (Sol/Terra/Luna), Claude 5 (Opus/Sonnet), Gemini 3.7 Flash, Grok 4.6, DeepSeek V4 Pro/Flash, GLM-5.3/5.3-Flash, Kimi K3, MiniMax M3, MiMo V2.5, NVIDIA Nemotron 3 Ultra, Qwen3.8, Gemma 4 and DiffusionGemma.

## Routing roles
- Frontier reasoning/research: GPT-5.6 Sol, Claude Opus 5.
- Balanced agents/coding: GPT-5.6 Terra, Claude Sonnet 5, Gemini 3.7 Flash.
- Long-horizon/open-weight agents: GLM-5.3, Kimi K3, MiniMax M3, MiMo V2.5 Pro.
- Efficient/value coding: DeepSeek V4 Flash, GLM-5.3 Flash.
- Local/open-weight watchlist: Qwen3.8, Gemma 4, DiffusionGemma, Nemotron 3 Ultra (hardware requirements vary greatly).

## Architecture consequence
OS exposes models through a generic provider/model catalog. OpenAI-compatible endpoints cover many vendors; Anthropic is supported through its native Messages API. Local weights belong under `Models/` and can be connected to a bundled inference backend without changing the agent core.
