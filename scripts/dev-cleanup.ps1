# Usuwa zombie node tylko z kebabkiller_studio2; chroni sluchajace :4005/:5174
$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\dev-common.ps1"

$protected = New-Object 'System.Collections.Generic.HashSet[int]'
Protect-DevPortTrees -Protected $protected

$killed = 0
function Remove-ZombieNode {
  param([int]$ProcId)
  if ($ProcId -le 0 -or $protected.Contains($ProcId)) { return $false }
  $listening = Get-NetTCPConnection -State Listen -OwningProcess $ProcId -ErrorAction SilentlyContinue
  if ($listening) { return $false }
  Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
  return $true
}

foreach ($z in (Get-DevZombieNodes -Protected $protected)) {
  if (Remove-ZombieNode $z.ProcessId) { $killed++ }
}

Start-Sleep -Seconds 1

Write-Host ''
Write-Host "Usunieto osieroconych procesow studio2: $killed" -ForegroundColor Green
Write-Host ''
Write-Host 'Stan portow studio2:'
foreach ($port in $script:Studio2DevPorts) {
  $info = Test-PortListen -Port $port
  if ($info) {
    Write-Host ("  [OK] port {0} PID {1}" -f $port, $info.Pid) -ForegroundColor Green
  } else {
    Write-Host ("  [!!] port {0} BRAK - uruchom: npm run restart:dev" -f $port) -ForegroundColor Red
  }
}
Write-Host ''
