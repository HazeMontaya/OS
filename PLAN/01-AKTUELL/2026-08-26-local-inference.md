---
title: Lokale Inference Engine und Model Assets
status: aktiv
priority: hoch
created: 2026-08-26
tags: [local-ai, inference, models, gpu]
---

# Lokale Inference Engine und Model Assets

## Ziel
Lokale Open-Weight-Modelle aus `OS/Models` ohne systemweite Installation nutzen.

## Aufgaben
- [ ] inference backend abstraction
- [ ] hardware detection CPU/RAM/VRAM
- [ ] model manifest
- [ ] download/import manager
- [ ] quantization metadata
- [ ] context limits
- [ ] GPU offload config
- [ ] lifecycle/load/unload
- [ ] health metrics
- [ ] local OpenAI-compatible endpoint
- [ ] model storage quotas

## Regel
Große Gewichte modular laden; nicht alle Modelle zwangsweise im Basis-ZIP bundeln.
