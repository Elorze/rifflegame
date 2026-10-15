# Run e2e with local Playwright + browsers on D: (no reinstall)
param(
  [Parameter(Mandatory = $true)]
  [string]$Script
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:PLAYWRIGHT_BROWSERS_PATH = "D:\ms-playwright"
$env:NODE_PATH = (Resolve-Path ".\node_modules").Path
$env:PLAYWRIGHT_CHROME = "D:\ms-playwright\chromium-1243\chrome-win64\chrome.exe"

& D:\node.exe $Script
exit $LASTEXITCODE
