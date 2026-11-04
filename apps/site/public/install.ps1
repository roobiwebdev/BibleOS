# BibleOS installer for Windows 10 and 11.
#
#   irm https://bible.roobi.dev/install.ps1 | iex
#
# Downloads the latest BibleOS setup from the project's GitHub releases, installs it for the
# current user (no administrator rights needed) and opens it. Downloading from PowerShell, not a
# browser, means Windows doesn't flag the file, so SmartScreen doesn't stop the install.
# Updates later arrive inside the app.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the progress bar makes Invoke-WebRequest very slow
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = 'roobiwebdev/BibleOS-releases'

function Say($text) { Write-Host "  $text" }

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'BibleOS needs 64-bit Windows 10 or 11.'
}

Write-Host ''
Write-Host '  BibleOS' -ForegroundColor Cyan
Say 'Finding the latest version...'
$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'BibleOS-installer' }
$asset = $release.assets | Where-Object { $_.name -like '*_x64-setup.exe' } | Select-Object -First 1
if (-not $asset) { throw "No Windows installer found in release $($release.tag_name)." }

$setup = Join-Path $env:TEMP $asset.name
Say "Downloading BibleOS $($release.tag_name.TrimStart('v')) ($([math]::Round($asset.size / 1MB)) MB)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $setup -UseBasicParsing

Say 'Installing...'
$process = Start-Process -FilePath $setup -ArgumentList '/S' -Wait -PassThru
Remove-Item $setup -ErrorAction SilentlyContinue
if ($process.ExitCode -ne 0) { throw "The installer stopped with exit code $($process.ExitCode)." }

# The setup installs per user into %LOCALAPPDATA%\BibleOS.
$dir = Join-Path $env:LOCALAPPDATA 'BibleOS'
$app = Get-ChildItem $dir -Filter '*.exe' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notmatch 'uninstall' } | Select-Object -First 1
if ($app) {
  Say 'Done. Opening BibleOS...'
  Start-Process $app.FullName
} else {
  Say 'Done. Open BibleOS from the Start menu.'
}
Write-Host ''
