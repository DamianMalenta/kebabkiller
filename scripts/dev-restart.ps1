# Restart kebabkiller_studio2 - tylko :4005 / :5174 (nie dotyka macius/Symbiont)
$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\dev-common.ps1"

$paths = Get-Studio2Paths
$backendPort = $script:Studio2DevPorts[0]
$frontendPort = $script:Studio2DevPorts[1]

Write-Host ''
Write-Host '=== RESTART STUDIO2 DEV ===' -ForegroundColor Cyan
Write-Host "  Root: $($paths.Studio2Root)"
Write-Host "  Porty: backend $backendPort, frontend $frontendPort"
Write-Host '  Macius (:8787/:4001/:5173) - bez zmian'
Write-Host ''

Write-Host "  1/4 Zatrzymywanie portow $backendPort, $frontendPort..."
Stop-Studio2PortListeners
Start-Sleep -Seconds 2

Write-Host '  2/4 Cleanup zombie studio2...'
& "$PSScriptRoot\dev-cleanup.ps1" | Out-Null

Write-Host '  3/4 Uruchamianie serwerow...'
$startBackend = "Set-Location -LiteralPath '$($paths.BackendDir)'; npm run dev"
$startFrontend = "Set-Location -LiteralPath '$($paths.Studio2Root)'; npm run dev --prefix frontend"

Start-Process powershell -ArgumentList '-NoProfile', '-Command', $startBackend -WindowStyle Minimized | Out-Null
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList '-NoProfile', '-Command', $startFrontend -WindowStyle Minimized | Out-Null

Write-Host '  4/4 Oczekiwanie na porty (max 20s)...'
$ready = $false
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Seconds 2
  $b = Test-PortListen -Port $backendPort
  $f = Test-PortListen -Port $frontendPort
  if ($b -and $f) { $ready = $true; break }
}

Write-Host ''
if ($ready) {
  Write-Host '  [OK] Studio2 uruchomione.' -ForegroundColor Green
} else {
  Write-Host '  [!!] Nie wszystkie porty wstaly - npm run status:dev' -ForegroundColor Yellow
}

Write-Host ''
Write-Host ('  Frontend: http://127.0.0.1:{0}/' -f $frontendPort)
Write-Host ('  Backend:  http://127.0.0.1:{0}/api/health' -f $backendPort)
Write-Host ''

& (Join-Path $PSScriptRoot 'dev-status.ps1')
