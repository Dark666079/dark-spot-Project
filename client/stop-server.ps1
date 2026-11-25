$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".runtime/server.pid"
if (-not (Test-Path $pidFile)) {
  Write-Host "No saved server process was found."
  exit 0
}
$rawPid = Get-Content $pidFile -ErrorAction SilentlyContinue
if (-not $rawPid) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Host "Server is already stopped."
  exit 0
}
$serverPid = [int]$rawPid
$p = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
if ($p -and $p.CommandLine -match "server[\\/]server\.js") {
  Stop-Process -Id $serverPid -Force
  Write-Host "Dark Spot server stopped." -ForegroundColor Green
} elseif ($p) {
  Write-Host "PID belongs to another process; it was not stopped." -ForegroundColor Yellow
} else {
  Write-Host "Dark Spot server is already stopped."
}
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
