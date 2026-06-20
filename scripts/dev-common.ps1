# Dev stack kebabkiller_studio2 — porty 4005/5174 (nie koliduj z macius: 8787/4001/5173)
$ErrorActionPreference = 'SilentlyContinue'

. "$PSScriptRoot\dev-ports.ps1"

function Get-Studio2Paths {
  $root = Split-Path $PSScriptRoot -Parent
  [pscustomobject]@{
    Studio2Root = $root
    BackendDir  = Join-Path $root 'backend'
    FrontendDir = Join-Path $root 'frontend'
    EnvFile     = Join-Path $root 'backend\.env'
  }
}

function Protect-DevPortTrees {
  param([System.Collections.Generic.HashSet[int]]$Protected)
  function Protect-Tree([int]$procId) {
    if ($procId -le 0 -or $Protected.Contains($procId)) { return }
    [void]$Protected.Add($procId)
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
    if ($p -and $p.ParentProcessId) { Protect-Tree $p.ParentProcessId }
  }
  foreach ($port in $script:Studio2DevPorts) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { Protect-Tree $_.OwningProcess }
  }
}

function Get-DevZombieNodes {
  param([System.Collections.Generic.HashSet[int]]$Protected)
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    if ($Protected.Contains($_.ProcessId)) { return $false }
    $_.CommandLine -match $script:Studio2ZombiePattern
  }
}

function Stop-Studio2PortListeners {
  foreach ($port in $script:Studio2DevPorts) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object {
        if ($_ -and $_ -ne 0) {
          Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
      }
  }
}

function Format-CommandLine {
  param([string]$Line, [int]$Max = 80)
  if (-not $Line) { return '(brak cmdline)' }
  if ($Line.Length -gt $Max) { return $Line.Substring(0, $Max) + '...' }
  return $Line
}

function Test-PortListen {
  param([int]$Port)
  $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $c) { return $null }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"
  [pscustomobject]@{
    Port    = $Port
    Pid     = $c.OwningProcess
    Command = Format-CommandLine $proc.CommandLine
  }
}
