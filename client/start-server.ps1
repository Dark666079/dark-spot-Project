$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root ".runtime"
$pidFile = Join-Path $runtime "server.pid"
New-Item -ItemType Directory -Force -Path $runtime | Out-Null

if (Test-Path $pidFile) {
  $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($oldPid) {
    $p = Get-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue
    if ($p) {
      Write-Host "Dark Spot is already running (PID $oldPid)."
      exit 0
    }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "Node.js is not installed or is not in PATH." -ForegroundColor Red
  exit 1
}

$proc = Start-Process -FilePath $node.Source -ArgumentList "server/server.js" -WorkingDirectory $root -PassThru -WindowStyle Hidden
Set-Content -Path $pidFile -Value $proc.Id
Start-Sleep -Seconds 2
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -TimeoutSec 3
  if ($health.ok) { Write-Host "Dark Spot server started successfully." -ForegroundColor Green }
  else { Write-Host "Server started, but health check did not pass." -ForegroundColor Yellow }
} catch {
  Write-Host "Server process started (PID $($proc.Id)), but health check failed. Check port 3000." -ForegroundColor Yellow
}
