# 오프라인 시연 서버: dist/를 이 컴퓨터 안에서만(127.0.0.1) 열고 브라우저를 오프라인 시연 모드(?offline=1)로 띄운다.
# 설치할 것 없음(Windows 기본 PowerShell). 인터넷·관리자 권한·방화벽 허용이 필요 없다.
# 실행: offline-demo.cmd 더블클릭, 또는
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\offline\serve.ps1 [-Port 8770] [-NoBrowser]
# 창을 닫거나 Ctrl+C를 누르면 서버가 꺼진다.
param(
  [int]$Port = 8770,   # 쓰고 있으면 다음 번호(최대 +9)
  [switch]$NoBrowser,
  [string]$Root
)
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Join-Path $PSScriptRoot '..\..\dist' }
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) { throw "index.html이 없습니다: $Root" }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'
}

# A plain TCP listener on the loopback address: unlike HttpListener it needs no URL reservation or admin rights.
$listener = $null
for ($p = $Port; $p -le $Port + 9 -and -not $listener; $p++) {
  try { $l = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $p); $l.Start(); $listener = $l; $Port = $p } catch {}
}
if (-not $listener) { throw "포트 $Port~$($Port + 9)을 모두 쓰고 있습니다. -Port로 다른 번호를 주세요." }
$url = "http://127.0.0.1:$Port/"

function Send-Response($stream, [string]$request) {
  $line = ($request -split "`r`n")[0]
  $parts = $line -split ' '
  $method = $parts[0]
  $status = '200 OK'; $type = 'text/plain; charset=utf-8'; $body = $null
  if ($parts.Count -lt 2 -or ($method -ne 'GET' -and $method -ne 'HEAD')) {
    $status = '405 Method Not Allowed'; $body = [Text.Encoding]::UTF8.GetBytes('method not allowed')
  } else {
    # The chatbot's /api/ask and anything outside dist/ get a plain 404, like any static server.
    $path = [Uri]::UnescapeDataString(($parts[1] -split '[?#]')[0])
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $Root ($path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar))))
    if (Test-Path -LiteralPath $file -PathType Container) { $file = Join-Path $file 'index.html' }
    if (-not $file.StartsWith($Root + [IO.Path]::DirectorySeparatorChar)) {
      $status = '403 Forbidden'; $body = [Text.Encoding]::UTF8.GetBytes('forbidden')
    } elseif (Test-Path -LiteralPath $file -PathType Leaf) {
      $body = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      if ($types.ContainsKey($ext)) { $type = $types[$ext] } else { $type = 'application/octet-stream' }
    } else {
      $status = '404 Not Found'; $body = [Text.Encoding]::UTF8.GetBytes('not found')
    }
  }
  $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
  $h = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($h, 0, $h.Length)
  if ($method -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

Write-Host ''
Write-Host '  블루바이오 가치지도 · 오프라인 시연'
Write-Host "  주소: $($url)?offline=1"
Write-Host '  이 창을 닫으면 시연 서버가 꺼집니다.'
Write-Host ''
if (-not $NoBrowser) { Start-Process "$($url)?offline=1" }

# One thread serves every connection in turn: browsers also open idle "preconnect" sockets, so a socket is read only
# when it has data, and one that stays silent is dropped after 30 s.
$clients = New-Object System.Collections.ArrayList
$buf = New-Object byte[] 16384
try {
  while ($true) {
    while ($listener.Pending()) {
      [void]$clients.Add([pscustomobject]@{ Client = $listener.AcceptTcpClient(); Data = (New-Object IO.MemoryStream); Seen = [DateTime]::UtcNow })
    }
    $busy = $false
    foreach ($c in @($clients)) {
      $drop = $false
      try {
        $sock = $c.Client.Client
        if ($c.Client.Available -gt 0) {
          $busy = $true
          $stream = $c.Client.GetStream()
          $n = $stream.Read($buf, 0, $buf.Length)
          $c.Data.Write($buf, 0, $n); $c.Seen = [DateTime]::UtcNow
          $text = [Text.Encoding]::ASCII.GetString($c.Data.ToArray())
          if ($text.Contains("`r`n`r`n")) {
            Send-Response $stream $text
            try { $sock.Shutdown([Net.Sockets.SocketShutdown]::Send) } catch {}
            $drop = $true
          } elseif ($c.Data.Length -gt 65536) { $drop = $true }
        } elseif ($sock.Poll(0, [Net.Sockets.SelectMode]::SelectRead) -or ([DateTime]::UtcNow - $c.Seen).TotalSeconds -gt 30) {
          $drop = $true # closed by the browser (readable with nothing to read) or idle
        }
      } catch { $drop = $true }
      if ($drop) { try { $c.Client.Close() } catch {}; $clients.Remove($c) }
    }
    if (-not $busy) { Start-Sleep -Milliseconds 5 }
  }
} finally {
  foreach ($c in $clients) { try { $c.Client.Close() } catch {} }
  $listener.Stop()
}
