#requires -Version 5.1
<#
.SYNOPSIS
    OS Structure Guard - Validates and enforces the canonical directory structure.
.DESCRIPTION
    Checks for:
    - Unauthorized files in root directory
    - Invalid directory structure
    - Duplicate files
    - Hash duplicates
    - Versioned filenames
    - Empty legacy directories
    - Cache/logs in wrong locations
    - Tote Referenzen (dead references)
    
    Can run in check-only mode or enforce mode.
.PARAMETER Enforce
    If specified, actively fixes issues (moves violations to Recovery\Quarantine).
.PARAMETER LogFile
    Path to log file. Defaults to S:\OS\Logs\structure-guard.log
.PARAMETER Root
    OS root directory. Defaults to the repository root inferred from this script.
#>
param(
    [switch]$Enforce,
    [string]$LogFile,
    [string]$Root
)

$ErrorActionPreference = "Continue"
$scriptRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
if (-not $Root) { $Root = $scriptRoot }
if (-not $LogFile) { $LogFile = Join-Path $Root "Logs\structure-guard.log" }
$QuarantineBase = Join-Path $Root "Recovery\Quarantine"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runEntries = [System.Collections.Generic.List[string]]::new()

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

# Allowed root directories
$AllowedRootDirs = @(
    "AI-Brain",
    "Apps",
    "Config",
    "Core",
    "Data",
    "Docs",
    "Integrations",
    "Logs",
    "Recovery",
    "Runtime",
    "Tools",
    "Workspace"
)

# Allowed root files
$AllowedRootFiles = @(
    "INSTALL_OS.cmd",
    "START_OS.cmd",
    "README.md"
)

# Version patterns to detect
$VersionPatterns = @(
    "V0[0-9]+",
    "v[0-9]+",
    "-old",
    "-new",
    "-final",
    "-copy",
    "-backup",
    "-test",
    "-temp"
)
$IgnoredPathPatterns = @(
    "\\(Recovery|\.git|node_modules|\.obsidian|Cache|Temp|Logs|Downloads)(\\|$)",
    "\\Apps\\VSCode\\data\\",
    "\\Config\\Codex\\\.tmp\\",
    "\\Config\\Obsidian\\"
)

function Test-IgnoredPath {
    param([string]$Path)
    foreach ($pattern in $IgnoredPathPatterns) {
        if ($Path -match $pattern) { return $true }
    }
    return $false
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $logEntry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
    $runEntries.Add($logEntry)
    Add-Content -Path $LogFile -Value $logEntry -ErrorAction SilentlyContinue
    if ($Level -eq "ERROR") {
        Write-Host $logEntry -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host $logEntry -ForegroundColor Yellow
    } else {
        Write-Host $logEntry -ForegroundColor Gray
    }
}

function Move-ToQuarantine {
    param([string]$Path, [string]$Reason)
    $quarantineDir = Join-Path $QuarantineBase $Timestamp
    New-Item -ItemType Directory -Path $quarantineDir -Force | Out-Null
    
    $item = Get-Item -Path $Path -Force
    $dest = Join-Path $quarantineDir $item.Name
    
    # Create manifest
    $manifest = @{
        originalPath = $Path
        reason = $Reason
        timestamp = (Get-Date -Format "o")
        hash = (Get-FileHash -Path $Path -Algorithm SHA256).Hash
    }
    
    $manifestPath = Join-Path $quarantineDir "manifest.json"
    if (-not (Test-Path $manifestPath)) {
        $manifest | ConvertTo-Json | Set-Content -Path $manifestPath
    }
    
    Move-Item -Path $Path -Destination $dest -Force
    Write-Log "Quarantined: $Path -> $dest (Reason: $Reason)" "WARN"
}

function Test-RootStructure {
    Write-Log "Checking root structure..."
    
    # Check for unauthorized directories
    $rootDirs = Get-ChildItem -Path $Root -Directory -Force
    foreach ($dir in $rootDirs) {
        if ($dir.Name -notin $AllowedRootDirs) {
            Write-Log "Unauthorized directory in root: $($dir.Name)" "ERROR"
            if ($Enforce) {
                Move-ToQuarantine -Path $dir.FullName -Reason "Unauthorized root directory"
            }
        }
    }
    
    # Check for unauthorized files
    $rootFiles = Get-ChildItem -Path $Root -File -Force
    foreach ($file in $rootFiles) {
        if ($file.Name -notin $AllowedRootFiles) {
            Write-Log "Unauthorized file in root: $($file.Name)" "ERROR"
            if ($Enforce) {
                Move-ToQuarantine -Path $file.FullName -Reason "Unauthorized root file"
            }
        }
    }
}

function Test-VersionedFiles {
    Write-Log "Checking for versioned files..."
    
    $allFiles = Get-ChildItem -Path $Root -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { -not (Test-IgnoredPath $_.FullName) }
    
    foreach ($file in $allFiles) {
        foreach ($pattern in $VersionPatterns) {
            if ($file.Name -match $pattern) {
                Write-Log "Versioned file detected: $($file.FullName)" "WARN"
                if ($Enforce) {
                    Move-ToQuarantine -Path $file.FullName -Reason "Versioned filename pattern: $pattern"
                }
                break
            }
        }
    }
}

function Test-DuplicateFiles {
    Write-Log "Checking for duplicate files..."
    
    # Exclude system directories and tool internals (Git has expected duplicates)
    $allFiles = Get-ChildItem -Path $Root -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\(Recovery|\.git|node_modules|\.obsidian|Tools\\Git)\\" }
    
    $hashGroups = $allFiles | Group-Object -Property { (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash } |
        Where-Object { $_.Count -gt 1 }
    
    foreach ($group in $hashGroups) {
        Write-Log "Hash duplicate group: $($group.Name)" "WARN"
        $files = $group.Group | Sort-Object LastWriteTime -Descending
        $keep = $files[0]
        Write-Log "  Keeping: $($keep.FullName)" "INFO"
        for ($i = 1; $i -lt $files.Count; $i++) {
            Write-Log "  Duplicate: $($files[$i].FullName)" "WARN"
            if ($Enforce) {
                Move-ToQuarantine -Path $files[$i].FullName -Reason "Hash duplicate of $($keep.FullName)"
            }
        }
    }
}

function Test-EmptyDirectories {
    Write-Log "Checking for empty directories..."
    
    $emptyDirs = Get-ChildItem -Path $Root -Recurse -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { 
            $_.FullName -notmatch "\\(Recovery|\.git|node_modules|\.obsidian)\\" -and
            (Get-ChildItem -Path $_.FullName -Force -ErrorAction SilentlyContinue).Count -eq 0
        }
    
    foreach ($dir in $emptyDirs) {
        Write-Log "Empty directory: $($dir.FullName)" "WARN"
        if ($Enforce) {
            Remove-Item -Path $dir.FullName -Force -ErrorAction SilentlyContinue
            Write-Log "Removed empty directory: $($dir.FullName)" "INFO"
        }
    }
}

function Test-DeadReferences {
    Write-Log "Checking for dead references..."
    
    $configFiles = Get-ChildItem -Path $Root -Recurse -Include "*.json","*.cmd","*.ps1","*.md" -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\(Recovery|\.git|node_modules|\.obsidian)\\" }
    
    foreach ($file in $configFiles) {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($content) {
            # Check absolute references that point into this portable root.
            $escapedRoot = [regex]::Escape($Root.TrimEnd('\'))
            $referencePattern = $escapedRoot + '\\[^\s"''`;,)\]+'
            $matches = [regex]::Matches($content, $referencePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            foreach ($match in $matches) {
                $referencedPath = $match.Value
                # Clean up path (remove trailing punctuation)
                $referencedPath = $referencedPath -replace '[,;:\)]+$', ''
                
                if (-not (Test-Path -Path $referencedPath -ErrorAction SilentlyContinue)) {
                    Write-Log "Dead reference in $($file.Name): $referencedPath" "WARN"
                }
            }
        }
    }
}

function Test-CacheLocations {
    Write-Log "Checking cache locations..."
    
    $cacheLocations = @(
        (Join-Path $Root "node_modules"),
        (Join-Path $Root ".npm"),
        (Join-Path $Root ".cache")
    )
    
    foreach ($loc in $cacheLocations) {
        if (Test-Path -Path $loc) {
            Write-Log "Cache in wrong location: $loc" "WARN"
            if ($Enforce) {
                Move-ToQuarantine -Path $loc -Reason "Cache in wrong location"
            }
        }
    }
}

# Main execution
Write-Log "=== Structure Guard Started ===" "INFO"
Write-Log "Mode: $(if ($Enforce) { 'Enforce' } else { 'Check-only' })" "INFO"

Test-RootStructure
Test-VersionedFiles
Test-DuplicateFiles
Test-EmptyDirectories
Test-DeadReferences
Test-CacheLocations

Write-Log "=== Structure Guard Completed ===" "INFO"

# Return summary
$violations = @($runEntries | Where-Object { $_ -match "\[ERROR\]" }).Count
$warnings = @($runEntries | Where-Object { $_ -match "\[WARN\]" }).Count

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Errors: $violations" -ForegroundColor $(if ($violations -gt 0) { "Red" } else { "Green" })
Write-Host "  Warnings: $warnings" -ForegroundColor $(if ($warnings -gt 0) { "Yellow" } else { "Green" })

if ($violations -gt 0 -and -not $Enforce) {
    Write-Host "`nRun with -Enforce to fix issues." -ForegroundColor Yellow
}
