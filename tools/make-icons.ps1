# Рисует иконки приложения (для установки на телефон) в папку icons/.
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
# Мяч на фирменном салатовом фоне; фон на всю площадь, мяч в «безопасной зоне» (maskable).
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-Pentagon([double]$cx, [double]$cy, [double]$r, [double]$rot) {
    $pts = New-Object 'System.Drawing.PointF[]' 5
    for ($i = 0; $i -lt 5; $i++) {
        $a = ($rot + $i * 72 - 90) * [Math]::PI / 180
        $pts[$i] = New-Object System.Drawing.PointF ([float]($cx + $r * [Math]::Cos($a))), ([float]($cy + $r * [Math]::Sin($a)))
    }
    return , $pts
}

function Draw-Icon([int]$size, [string]$file, [bool]$rounded) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Фон: градиент фирменного салатового
    $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 196, 248, 92)), ([System.Drawing.Color]::FromArgb(255, 104, 186, 32)), 60
    if ($rounded) {
        $rr = $size * 0.22
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, $rr, $rr, 180, 90); $path.AddArc($size - $rr, 0, $rr, $rr, 270, 90)
        $path.AddArc($size - $rr, $size - $rr, $rr, $rr, 0, 90); $path.AddArc(0, $size - $rr, $rr, $rr, 90, 90)
        $path.CloseFigure(); $g.FillPath($bg, $path)
    } else { $g.FillRectangle($bg, $rect) }

    # Мяч: тень, белый круг, пятиугольники, обводка
    $c = $size / 2; $R = $size * 0.30
    $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 10, 20, 5))
    $g.FillEllipse($shadow, [float]($c - $R + $size * 0.02), [float]($c - $R + $size * 0.035), [float](2 * $R), [float](2 * $R))
    $g.FillEllipse([System.Drawing.Brushes]::White, [float]($c - $R), [float]($c - $R), [float](2 * $R), [float](2 * $R))

    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    $clip.AddEllipse([float]($c - $R), [float]($c - $R), [float](2 * $R), [float](2 * $R))
    $g.SetClip($clip)
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 11, 20, 38))
    $g.FillPolygon($ink, (New-Pentagon $c $c ($R * 0.36) 0))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 11, 20, 38)), ([float]($size * 0.012))
    for ($i = 0; $i -lt 5; $i++) {
        $a = ($i * 72 - 90) * [Math]::PI / 180
        $inner = (New-Pentagon $c $c ($R * 0.36) 0)[$i]
        $px = $c + $R * 0.98 * [Math]::Cos($a); $py = $c + $R * 0.98 * [Math]::Sin($a)
        $g.DrawLine($pen, $inner, (New-Object System.Drawing.PointF ([float]($c + $R * 0.66 * [Math]::Cos($a))), ([float]($c + $R * 0.66 * [Math]::Sin($a)))))
        $g.FillPolygon($ink, (New-Pentagon $px $py ($R * 0.30) 36))
    }
    $g.ResetClip()
    $ring = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 11, 20, 38)), ([float]($size * 0.016))
    $g.DrawEllipse($ring, [float]($c - $R), [float]($c - $R), [float](2 * $R), [float](2 * $R))

    $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "icons/$file"
}

Draw-Icon 512 'icon-512.png' $true
Draw-Icon 192 'icon-192.png' $true
Draw-Icon 512 'icon-maskable-512.png' $false
Draw-Icon 180 'apple-touch-icon.png' $false
Draw-Icon 32 'favicon-32.png' $true
