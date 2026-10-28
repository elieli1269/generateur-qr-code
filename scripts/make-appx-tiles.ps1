$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\build\appx'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function New-QrTile([int]$w, [int]$h, [string]$path, [bool]$wide) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 15, 23, 42))

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
  $navy = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))

  $side = [Math]::Min($w, $h)
  $pad = [Math]::Max(2, [int]($side * 0.12))
  $box = $side - (2 * $pad)
  $ox = [int](($w - $box) / 2)
  $oy = [int](($h - $box) / 2)
  if ($wide) {
    $ox = [int]($w * 0.08)
    $oy = [int](($h - $box) / 2)
  }

  $cell = [Math]::Max(1, [int]($box / 7))
  function Draw-Finder($gx, $gy, $ox0, $oy0, $cell0) {
    $gx.FillRectangle($white, $ox0, $oy0, (7 * $cell0), (7 * $cell0))
    $gx.FillRectangle($navy, ($ox0 + $cell0), ($oy0 + $cell0), (5 * $cell0), (5 * $cell0))
    $gx.FillRectangle($blue, ($ox0 + (2 * $cell0)), ($oy0 + (2 * $cell0)), (3 * $cell0), (3 * $cell0))
  }

  Draw-Finder $g $white $ox $oy $cell
  $g.FillRectangle($white, ($ox + (5 * $cell)), ($oy + (5 * $cell)), (2 * $cell), (2 * $cell))
  $g.FillRectangle($white, ($ox + (4 * $cell)), ($oy + $cell), $cell, $cell)
  $g.FillRectangle($white, ($ox + $cell), ($oy + (4 * $cell)), $cell, $cell)

  if ($wide -and $w -ge 200) {
    $fontSize = [Math]::Max(18, [int]($h * 0.28))
    $font = New-Object System.Drawing.Font 'Segoe UI', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString('QR Folio', $font, $white, ($ox + $box + [int]($w * 0.04)), [int](($h - $fontSize) / 2 - 4))
    $font.Dispose()
  }

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $white.Dispose(); $blue.Dispose(); $navy.Dispose()
}

New-QrTile 50 50 (Join-Path $out 'StoreLogo.png') $false
New-QrTile 44 44 (Join-Path $out 'Square44x44Logo.png') $false
New-QrTile 71 71 (Join-Path $out 'SmallTile.png') $false
New-QrTile 150 150 (Join-Path $out 'Square150x150Logo.png') $false
New-QrTile 310 310 (Join-Path $out 'LargeTile.png') $false
New-QrTile 310 150 (Join-Path $out 'Wide310x150Logo.png') $true
New-QrTile 620 300 (Join-Path $out 'SplashScreen.png') $true
New-QrTile 24 24 (Join-Path $out 'BadgeLogo.png') $false
Write-Host 'AppX tiles written to' $out
