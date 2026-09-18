param(
  [ValidateSet("auto","ollama","omniroute","vllm","llamacpp")]
  [string]$Provider = "auto",
  [string]$Model = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
New-Item -ItemType Directory -Force .os, .os\models, .os\logs | Out-Null

function Has($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

if ($Provider -eq "auto") {
  if (Has "ollama") { $Provider = "ollama" }
  elseif (Has "omniroute") { $Provider = "omniroute" }
  elseif (Has "vllm") { $Provider = "vllm" }
  elseif (Has "llama-server") { $Provider = "llamacpp" }
  else { $Provider = "none" }
}

if ($Provider -eq "none") {
  Write-Host "No local model runtime detected. Install Ollama/OmniRoute/vLLM/llama.cpp first."
  exit 2
}

if (-not $Model) {
  if ($Provider -eq "ollama") { $Model = "qwen3:8b" }
  elseif ($Provider -eq "omniroute") { $Model = "default" }
  elseif ($Provider -eq "vllm") { $Model = "Qwen/Qwen3-8B" }
  else { $Model = "local-model" }
}

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

$envLines = Get-Content ".env"
function Set-Env($name, $value) {
  $script:envLines = @($script:envLines | Where-Object { $_ -notmatch "^$name=" })
  $script:envLines += "$name=$value"
}
Set-Env "OS_MODEL_PROVIDER" $Provider
Set-Env "OS_MODEL" $Model

switch ($Provider) {
  "ollama" { Set-Env "OS_MODEL_ENDPOINT" "http://127.0.0.1:11434/v1/chat/completions" }
  "omniroute" { Set-Env "OS_MODEL_ENDPOINT" "http://127.0.0.1:20128/v1/chat/completions" }
  "vllm" { Set-Env "OS_MODEL_ENDPOINT" "http://127.0.0.1:8000/v1/chat/completions" }
  "llamacpp" { Set-Env "OS_MODEL_ENDPOINT" "http://127.0.0.1:8080/v1/chat/completions" }
}
$envLines | Set-Content ".env" -Encoding utf8
Write-Host "Configured provider=$Provider model=$Model"
Write-Host "No model is downloaded automatically unless the selected runtime exposes a package manager."
