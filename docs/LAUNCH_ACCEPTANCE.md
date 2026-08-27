# OS Launch Acceptance Contract

A source revision is **Windows launch-ready** only when all of the following are true:

1. Rust formatting, core tests, Clippy, CLI doctor and developer diagnostics pass.
2. The TypeScript workspace typechecks.
3. The production web experience builds.
4. Every `scripts/windows/*.ps1` file parses successfully under Windows PowerShell.
5. The Windows job runs a real Tauri release build with `--no-bundle`.
6. `target/release/os-desktop.exe` exists after that build and is uploaded as a CI artifact.
7. The desktop has a deterministic WebGL/Phase-3 fallback if WebGPU/compute initialization is unavailable.
8. `OS-SETUP.cmd` can provision or detect the required local build/runtime components.
9. `OS-DOCTOR.cmd` can identify missing WebView2, model runtime/models and source build prerequisites.
10. `OS-START.cmd` refuses to silently launch a release built from a different Git HEAD; it rebuilds first.
11. Local cognitive runtime defaults resolve to an OpenAI-compatible Ollama endpoint and explicit chat/embedding models unless the user overrides them.
12. `GIT-UPLOAD.cmd` blocks a stale local Git history from replacing a newer online `main` unless the operator explicitly supplies `--force-stale`.

The optional NSIS installer workflow is a distribution convenience. The release executable itself is the minimum launch artifact.

Experimental renderer phases do not block launch acceptance. A higher renderer phase becomes production only after it independently passes this same launch contract.
