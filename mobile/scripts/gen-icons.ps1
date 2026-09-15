Add-Type -AssemblyName System.Drawing

function New-MonogramPng {
    param(
        [string]$Path,
        [int]$Size,
        [bool]$Transparent,
        [string]$BgHex = "#0b0b0c",
        [double]$Scale = 0.62
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    if ($Transparent) {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $bgColor = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
        $g.Clear($bgColor)
    }

    $accent = [System.Drawing.ColorTranslator]::FromHtml("#f5f5f0")
    $brush = New-Object System.Drawing.SolidBrush($accent)

    $fontSize = [float]($Size * $Scale * 0.62)
    $font = New-Object System.Drawing.Font("Arial Black", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    $text = "SB"
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
    $g.DrawString($text, $font, $brush, $rect, $format)

    $g.Flush()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$imagesDir = Join-Path $PSScriptRoot "..\assets\images"

New-MonogramPng -Path (Join-Path $imagesDir "icon.png") -Size 1024 -Transparent $false -Scale 0.62
New-MonogramPng -Path (Join-Path $imagesDir "android-icon-foreground.png") -Size 1024 -Transparent $true -Scale 0.42
Copy-Item (Join-Path $imagesDir "android-icon-foreground.png") (Join-Path $imagesDir "android-icon-monochrome.png") -Force

Write-Host "Icons generated."
