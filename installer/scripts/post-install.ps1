param(
  [string]$InstallPath,
  [string]$DataDir
)

$ErrorActionPreference = "Stop"
$logFile = "$env:TEMP\UniPath-PostInstall.log"

function Log {
  param([string]$msg)
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Add-Content -Path $logFile -Value $line
  Write-Host $msg
}

Log "Post-install started for UniPath at $InstallPath"

# ── 1. Ensure data directory exists ──
if (-not (Test-Path $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
  Log "Created data directory: $DataDir"
}

# ── 2. Ensure backend binary is executable ──
$backendExe = Join-Path $InstallPath "backend-bin\unipath-backend.exe"
if (Test-Path $backendExe) {
  Log "Backend binary found: $backendExe"
} else {
  Log "WARNING: Backend binary not found at $backendExe"
}

# ── 3. Create UNIPATH_DATA_DIR environment variable (user level) ──
try {
  [Environment]::SetEnvironmentVariable("UNIPATH_DATA_DIR", $DataDir, "User")
  Log "Set UNIPATH_DATA_DIR user env var to $DataDir"
} catch {
  Log "WARNING: Could not set UNIPATH_DATA_DIR env var: $_"
}

# ── 4. Test backend binary ──
if (Test-Path $backendExe) {
  try {
    $proc = Start-Process -FilePath $backendExe -ArgumentList "--help" -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -eq 0) {
      Log "Backend binary is working"
    } else {
      Log "WARNING: Backend --help exited with code $($proc.ExitCode)"
    }
  } catch {
    Log "WARNING: Backend binary test failed: $_"
  }
}

# ── 5. Add firewall rule ──
try {
  $ruleName = "UniPath Backend"
  $existing = netsh advfirewall firewall show rule name="$ruleName" 2>$null
  if (-not $existing) {
    netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow program="$backendExe" enable=yes profile=private,domain description="Allow UniPath backend server" | Out-Null
    Log "Firewall rule added for backend"
  } else {
    Log "Firewall rule already exists"
  }
} catch {
  Log "WARNING: Could not add firewall rule: $_"
}

Log "Post-install completed successfully"
