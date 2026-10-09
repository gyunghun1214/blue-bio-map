# 오프라인 시연 준비: 위성·수심 배경 지도 타일을 dist/offline-tiles/에 저장한다 (인터넷 연결 필요, 한 번만).
# 범위는 tile-plan.json. 이미 받은 타일은 건너뛰므로 중간에 끊겨도 다시 실행하면 이어서 받는다.
# dist/offline-tiles/는 git에 올리지 않고(.gitignore) 배포에도 넣지 않는다(dist/.assetsignore).
# 실행: offline-demo-prepare.cmd 더블클릭, 또는
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\offline\prepare-offline.ps1 [-Check]
# Windows PowerShell 5.1과 PowerShell 7 모두에서 돈다.
param(
  [switch]$Check,   # 받지 않고 빠진 타일 수만 센다
  [string]$Out      # 저장 폴더 (기본: dist/offline-tiles)
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $Out) { $Out = Join-Path $repo 'dist\offline-tiles' }
$plan = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'tile-plan.json') | ConvertFrom-Json

function Get-TileX([double]$lon, [int]$z) { [int][Math]::Floor(($lon + 180) / 360 * [Math]::Pow(2, $z)) }
function Get-TileY([double]$lat, [int]$z) {
  $r = $lat * [Math]::PI / 180
  [int][Math]::Floor((1 - [Math]::Log([Math]::Tan($r) + 1 / [Math]::Cos($r)) / [Math]::PI) / 2 * [Math]::Pow(2, $z))
}
# EPSG:3857 bbox (minx,miny,maxx,maxy) of an XYZ tile, the same grid Leaflet's WMS layer requests.
function Get-TileBbox([int]$z, [int]$x, [int]$y) {
  $o = 20037508.342789244; $s = 2 * $o / [Math]::Pow(2, $z)
  $inv = [Globalization.CultureInfo]::InvariantCulture
  (@(($x * $s - $o), ($o - ($y + 1) * $s), (($x + 1) * $s - $o), ($o - $y * $s)) | ForEach-Object { $_.ToString('R', $inv) }) -join ','
}
function Expand-Template([string]$t, [int]$z, [int]$x, [int]$y) {
  $t.Replace('{z}', "$z").Replace('{x}', "$x").Replace('{y}', "$y").Replace('{bbox}', (Get-TileBbox $z $x $y))
}

$jobs = New-Object System.Collections.ArrayList
foreach ($level in $plan.levels) {
  for ($z = [int]$level.zooms[0]; $z -le [int]$level.zooms[1]; $z++) {
    $x0 = Get-TileX $level.west $z; $x1 = Get-TileX $level.east $z
    $y0 = Get-TileY $level.north $z; $y1 = Get-TileY $level.south $z
    for ($x = $x0; $x -le $x1; $x++) {
      for ($y = $y0; $y -le $y1; $y++) {
        foreach ($name in @('satellite', 'depth')) {
          $layer = $plan.layers.$name
          $file = Join-Path $Out ((Expand-Template $layer.path $z $x $y).Replace('/', [IO.Path]::DirectorySeparatorChar))
          [void]$jobs.Add([pscustomobject]@{ Name = $name; Url = (Expand-Template $layer.url $z $x $y); File = $file })
        }
      }
    }
  }
}
$missing = @($jobs | Where-Object { -not (Test-Path -LiteralPath $_.File) })
Write-Host ("배경 지도 타일 {0}개 중 {1}개가 아직 없습니다. 저장 위치: {2}" -f $jobs.Count, $missing.Count, $Out)
if ($Check) { if ($missing.Count) { exit 1 } else { exit 0 } }
if (-not $missing.Count) { Write-Host '이미 모두 받았습니다. offline-demo.cmd로 시연을 여세요.'; exit 0 }

try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
$client = New-Object System.Net.WebClient
# A file is kept only when it really is an image: a server error page saved as a tile would hide the fallback map.
function Test-Image([byte[]]$b) {
  ($b.Length -gt 8) -and ((($b[0] -eq 0xFF) -and ($b[1] -eq 0xD8)) -or (($b[0] -eq 0x89) -and ($b[1] -eq 0x50) -and ($b[2] -eq 0x4E) -and ($b[3] -eq 0x47)))
}
$done = 0; $failed = 0; $i = 0
foreach ($job in $missing) {
  $i++
  $bytes = $null
  for ($try = 1; $try -le 3 -and -not $bytes; $try++) {
    try {
      $client.Headers['User-Agent'] = 'blue-bio-map offline demo (one-time tile cache)'
      $b = $client.DownloadData($job.Url)
      if (Test-Image $b) { $bytes = $b } else { Start-Sleep -Seconds $try }
    } catch { Start-Sleep -Seconds $try }
  }
  if ($bytes) {
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($job.File))
    [IO.File]::WriteAllBytes($job.File, $bytes)
    $done++
  } else {
    $failed++
    Write-Host ("  받지 못함: {0}" -f $job.Url)
  }
  if ($i % 50 -eq 0 -or $i -eq $missing.Count) { Write-Host ("  {0} / {1} 처리" -f $i, $missing.Count) }
}
$size = (Get-ChildItem -LiteralPath $Out -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ("완료: 새로 받은 타일 {0}개, 실패 {1}개, 전체 {2:N1} MB" -f $done, $failed, ($size / 1MB))
if ($failed) { Write-Host '실패한 타일이 있습니다. 인터넷 연결을 확인하고 다시 실행하면 빠진 것만 받습니다.'; exit 1 }
Write-Host '준비 끝. 시연할 때는 offline-demo.cmd를 더블클릭하세요.'
