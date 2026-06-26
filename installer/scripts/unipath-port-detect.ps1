param(
  [int]$PreferredPort = 8000,
  [int]$MaxAttempts = 50
)

$startPort = $PreferredPort

for ($i = 0; $i -lt $MaxAttempts; $i++) {
  $port = $startPort + $i
  $listener = $null
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
    $listener.Start()
    Write-Output $port
    exit 0
  } catch {
    continue
  } finally {
    if ($listener) { $listener.Stop() }
  }
}

Write-Error "No free port found in range $startPort..$($startPort + $MaxAttempts - 1)"
exit 1
