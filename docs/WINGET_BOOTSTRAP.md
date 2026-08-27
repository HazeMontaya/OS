# WinGet bootstrap contract

`OS-SETUP.cmd` must not require Windows Package Manager to be preinstalled manually.

The Windows bootstrap uses the following recovery order:

1. Refresh `PATH`, including `%LOCALAPPDATA%\Microsoft\WindowsApps`, and locate an already registered `winget.exe`.
2. If WinGet is missing or unusable, follow Microsoft's supported troubleshooting path by installing/importing `Microsoft.WinGet.Client` and calling `Repair-WinGetPackageManager -Force -Latest`.
3. If the repair module path is unavailable or fails, download the latest stable Microsoft App Installer bundle through `https://aka.ms/getwinget` and register it with `Add-AppxPackage`.
4. Re-resolve and execute the actual WinGet executable. Package installation must use that resolved executable instead of assuming the shell alias is immediately refreshed.
5. Only after both automatic recovery paths fail may setup stop and ask for a one-time manual App Installer installation.

The bootstrap preserves the user's previous PSGallery trust policy after temporary module installation. Local machine state is not committed to the repository.
