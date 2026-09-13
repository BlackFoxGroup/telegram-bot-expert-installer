# Telegram Bot Expert Installer — one-command Windows setup
# Usage: irm https://raw.githubusercontent.com/BlackFoxGroup/telegram-bot-expert-installer/main/deploy/install-expert.ps1 | iex

$ErrorActionPreference = "Stop"
$RepoZip = "https://github.com/BlackFoxGroup/telegram-bot-expert-installer/raw/main/downloads/telegram-bot-expert-installer.zip"
$FallbackZip = "https://github.com/BlackFoxGroup/telegram-bot-expert-installer/archive/refs/heads/main.zip"
$Target = Join-Path $env:LOCALAPPDATA "TelegramBotExpert"

function Fail([string]$msg) {
  Write-Host $msg
  Read-Host "Enter"
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js is not installed. Install the LTS build from https://nodejs.org then run this command again."
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
$tmp = Join-Path $env:TEMP ("expert-" + [guid]::NewGuid().ToString("N") + ".zip")
Write-Host "Downloading Expert..."
try {
  Invoke-WebRequest -Uri $RepoZip -OutFile $tmp -UseBasicParsing
} catch {
  Invoke-WebRequest -Uri $FallbackZip -OutFile $tmp -UseBasicParsing
}

$extract = Join-Path $env:TEMP ("expert-src-" + [guid]::NewGuid().ToString("N"))
Expand-Archive -Path $tmp -DestinationPath $extract -Force
$inner = Get-ChildItem $extract | Where-Object { $_.PSIsContainer } | Select-Object -First 1
$from = if ($inner) { $inner.FullName } else { $extract }
Copy-Item -Path (Join-Path $from "*") -Destination $Target -Recurse -Force

Set-Location $Target
Write-Host "Installing packages..."
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { Fail "npm run build failed." }

Write-Host "Starting Expert at http://127.0.0.1:4780/"
if (Test-Path (Join-Path $Target "Start-Expert.bat")) {
  Start-Process -FilePath (Join-Path $Target "Start-Expert.bat")
} else {
  $env:NO_OPEN = $null
  Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $Target
}

Write-Host "Done. Folder: $Target"
