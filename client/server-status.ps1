$ErrorActionPreference = "SilentlyContinue"
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -TimeoutSec 2
  if ($health.ok) {
    Write-Host "STATUS: RUNNING" -ForegroundColor Green
    Write-Host "Address: http://127.0.0.1:3000"
    exit 0
  }
} catch {}
Write-Host "STATUS: STOPPED" -ForegroundColor Red
