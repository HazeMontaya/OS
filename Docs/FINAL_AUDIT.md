# OS implementation audit

**Date:** 2026-08-26  
**Runtime:** 0.8.0  
**Milestone:** PORTABLE DESKTOP FOUNDATION

## Implemented in this milestone
- Installer/start scripts removed from the target product flow.
- Secure Electron desktop shell added.
- Electron executable runs the Node runtime through `ELECTRON_RUN_AS_NODE`; a separate Node installation is not required in the packaged OS folder.
- GitHub Actions assembles a portable `OS-Windows-x64.zip` containing `OS.exe` and all required Electron runtime files.
- `OS_ROOT` makes the runtime relocatable inside the portable folder.
- Generic OpenAI-compatible provider transport added.
- Native Anthropic Messages adapter added.
- Current model catalog added at `Config/OS/models.json`.
- Model selection exposed through `/api/models` and the UI.
- Local model assets have a canonical root directory at `Models/`.

## Boundary
Cloud models still require their provider credentials. Local open-weight models require a bundled/selected inference backend and model weights; those large binaries are intentionally not stored in Git.
