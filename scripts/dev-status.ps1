# Raport dev kebabkiller_studio2 (:4005 / :5174) — nie dotyka macius/Symbiont
$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\dev-common.ps1"

$paths = Get-Studio2Paths
$backendPort = $script:Studio2DevPorts[0]
$frontendPort = $script:Studio2DevPorts[1]

Write-Host ''
Write-Host '=== KEBABKILLER STUDIO2 (Cursor) ===' -ForegroundColor Cyan
Write-Host "  Root: $($paths.Studio2Root)"
Write-Host ''

$services = @(
  @{ Port = $backendPort; Name = 'Studio2 backend'; Health = "http://127.0.0.1:$backendPort/api/health" }
  @{ Port = $frontendPort; Name = 'Studio2 frontend'; Health = "http://127.0.0.1:$frontendPort/api/system-agent/health" }
)

foreach ($svc in $services) {
  $info = Test-PortListen -Port $svc.Port
  if ($info) {
    $health = '-'
    if ($svc.Health) {
      try {
        $r = Invoke-WebRequest -Uri $svc.Health -TimeoutSec 3 -UseBasicParsing
        $health = "HTTP $($r.StatusCode)"
      } catch {
        $health = 'brak odpowiedzi'
      }
    }
    Write-Host ("  [{0}] {1,-18} PID {2,-7} {3}" -f 'OK', $svc.Name, $info.Pid, $health) -ForegroundColor Green
    Write-Host "       $($info.Command)"
    if ($info.Command -notmatch 'kebabkiller_studio2') {
      Write-Host '       [!] Inny projekt na tym porcie - zmien PORT/FRONTEND_PORT w backend/.env' -ForegroundColor Yellow
    }
  } else {
    Write-Host ("  [--] {0,-18} wylaczony" -f $svc.Name)
  }
}

Write-Host ''
Write-Host '=== MACIUS (zarezerwowane - nie uzywaj w studio2) ===' -ForegroundColor Cyan
foreach ($port in $script:MaciusReservedPorts) {
  $info = Test-PortListen -Port $port
  if ($info) {
    Write-Host ("  [OK] port {0} PID {1}" -f $port, $info.Pid) -ForegroundColor DarkGray
  } else {
    Write-Host ("  [--] port {0} wolny" -f $port) -ForegroundColor DarkGray
  }
}

Write-Host ''
Write-Host '=== ZOMBIE (tylko kebabkiller_studio2) ===' -ForegroundColor Cyan
$protected = New-Object 'System.Collections.Generic.HashSet[int]'
Protect-DevPortTrees -Protected $protected
$zombies = @(Get-DevZombieNodes -Protected $protected)

if ($zombies.Count -gt 0) {
  foreach ($z in $zombies) {
    Write-Host ("  ZOMBIE PID {0}: {1}" -f $z.ProcessId, (Format-CommandLine $z.CommandLine 90)) -ForegroundColor Yellow
  }
  Write-Host ''
  Write-Host '  Uruchom: npm run cleanup:dev  (pelny reset: npm run restart:dev)' -ForegroundColor Yellow
} else {
  Write-Host '  Brak osieroconych procesow.' -ForegroundColor Green
}

Write-Host ''
Write-Host '=== SKROTY ===' -ForegroundColor Cyan
Write-Host '  npm run status:dev   - ten raport'
Write-Host '  npm run cleanup:dev  - zombie studio2 (nie dotyka macius :4001/:5173)'
Write-Host '  npm run restart:dev  - restart :4005 + :5174'
Write-Host ''
Write-Host "  UI:       http://127.0.0.1:$frontendPort/"
Write-Host "  Telefon:  http://<LAN-IP>:$frontendPort/"
Write-Host ''
