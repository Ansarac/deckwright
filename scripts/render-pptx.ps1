#requires -Version 5.1
<#
.SYNOPSIS
    deckwright render script (Render PPTX -> one PNG per slide)

.DESCRIPTION
    Renders a **real exported .pptx** into "one PNG per slide" so that Claude can
    do visual QA directly on the real file
    (not an HTML proxy -- this is exactly the core differentiator of this project).

    The rendering backend is auto-selected from "one of two" (same strategy as scripts\check-deps.ps1):
      (A) Preferred: Microsoft PowerPoint -- exports pptx to PNG directly via COM;
      (B) Fallback:  LibreOffice + Poppler -- soffice converts to pdf, pdftoppm to png.

    Output: <outDir>\<basename>-1.png, <basename>-2.png, ... in slide order.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\render-pptx.ps1 out\sample.pptx .qa
#>

param(
    [Parameter(Mandatory = $true)] [string]$PptxPath,
    [Parameter(Mandatory = $true)] [string]$OutDir
)

$ErrorActionPreference = 'Stop'

function Fail {
    param([string]$Msg)
    Write-Host "Error: $Msg" -ForegroundColor Red
    exit 1
}

# ---- Argument validation + convert paths to absolute -----------------------
if (-not (Test-Path -LiteralPath $PptxPath)) {
    Fail "Input file not found: $PptxPath"
}
$absPptx = (Resolve-Path -LiteralPath $PptxPath).Path
if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$absOutDir = (Resolve-Path -LiteralPath $OutDir).Path
$baseName = [IO.Path]::GetFileNameWithoutExtension($absPptx)

# ---- Backend detection (without launching PowerPoint) ----------------------
function Find-PowerPoint {
    if (Test-Path 'Registry::HKEY_CLASSES_ROOT\PowerPoint.Application') { return $true }
    return $false
}
function Find-Soffice {
    $c = Get-Command 'soffice' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $candidates = @(
        "$env:ProgramFiles\LibreOffice\program\soffice.exe",
        "${env:ProgramFiles(x86)}\LibreOffice\program\soffice.exe"
    )
    foreach ($p in $candidates) { if ($p -and (Test-Path $p)) { return $p } }
    return $null
}
function Find-Pdftoppm {
    $c = Get-Command 'pdftoppm' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source } else { return $null }
}

# Sort by the trailing integer in the file name (handles both localized Office "Slide1.PNG" naming and English "Slide1.PNG")
function Sort-ByTrailingInt {
    param([System.IO.FileInfo[]]$Files)
    return $Files | Sort-Object {
        $m = [regex]::Match($_.BaseName, '(\d+)\s*$')
        if ($m.Success) { [int]$m.Groups[1].Value } else { [int]::MaxValue }
    }
}

# ---- Backend A: PowerPoint COM ---------------------------------------------
function Render-WithPowerPoint {
    Write-Host "Backend: Microsoft PowerPoint (COM)" -ForegroundColor Cyan

    # MsoTriState: msoTrue=-1, msoFalse=0 (the enum type may not be loaded, so use ints directly)
    $msoTrue = -1
    $msoFalse = 0

    # Export to a temporary subdirectory, then copy in order to <basename>-N.png
    # Note: PowerPoint COM's Export is sensitive to directory names starting with '.' (it raises 0x8007007B),
    # so use a plainly-named subdirectory under the system temp directory.
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("render-pptx-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null

    $app = $null
    $pres = $null
    try {
        $app = New-Object -ComObject PowerPoint.Application
        # Note: setting Visible=msoFalse on PowerPoint throws; just open the presentation in a hidden way.
        # Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse)
        $pres = $app.Presentations.Open($absPptx, $msoTrue, $msoFalse, $msoFalse)

        $slideCount = $pres.Slides.Count
        # Export the whole presentation: one PNG per slide written into $tmp
        $pres.Export($tmp, "PNG", 1920, 1080)

        $pngs = Get-ChildItem -LiteralPath $tmp -Filter *.png -File
        if (-not $pngs) {
            # In some cases the extension is uppercase .PNG; Filter is case-insensitive on NTFS, but filter again to be safe
            $pngs = Get-ChildItem -LiteralPath $tmp -File | Where-Object { $_.Extension -match '(?i)^\.png$' }
        }
        if (-not $pngs) { throw "PowerPoint export produced no PNG (export dir: $tmp)" }

        $sorted = Sort-ByTrailingInt -Files $pngs
        if ($sorted.Count -ne $slideCount) {
            throw "Number of exported PNGs ($($sorted.Count)) does not match slide count ($slideCount)"
        }

        $written = New-Object System.Collections.Generic.List[string]
        $i = 1
        foreach ($f in $sorted) {
            $dest = Join-Path $absOutDir ("{0}-{1}.png" -f $baseName, $i)
            Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
            $written.Add($dest)
            $i++
        }
        return $written
    }
    finally {
        if ($pres) {
            try { $pres.Close() } catch {}
            try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null } catch {}
            $pres = $null
        }
        if ($app) {
            try { $app.Quit() } catch {}
            try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null } catch {}
            $app = $null
        }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
        if (Test-Path -LiteralPath $tmp) {
            try { Remove-Item -LiteralPath $tmp -Recurse -Force } catch {}
        }
    }
}

# ---- Backend B: LibreOffice + Poppler --------------------------------------
function Render-WithLibreOffice {
    param([string]$Soffice)
    Write-Host "Backend: LibreOffice + Poppler  ($Soffice)" -ForegroundColor Cyan

    $tmp = Join-Path $absOutDir (".render-tmp-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        & $Soffice --headless --convert-to pdf --outdir $tmp $absPptx | Out-Null
        $pdf = Join-Path $tmp ($baseName + ".pdf")
        if (-not (Test-Path -LiteralPath $pdf)) {
            throw "LibreOffice failed to convert to PDF (expected: $pdf)"
        }
        # pdftoppm produces <prefix>-1.png, <prefix>-2.png, ...
        $prefix = Join-Path $absOutDir $baseName
        & pdftoppm -png -r 150 $pdf $prefix | Out-Null

        $pngs = Get-ChildItem -LiteralPath $absOutDir -Filter ($baseName + "-*.png") -File
        if (-not $pngs) { throw "pdftoppm produced no PNG" }

        # pdftoppm page numbers may be zero-padded (e.g. -01); rename to a clean <base>-N.png
        $sorted = Sort-ByTrailingInt -Files $pngs
        $written = New-Object System.Collections.Generic.List[string]
        $i = 1
        foreach ($f in $sorted) {
            $dest = Join-Path $absOutDir ("{0}-{1}.png" -f $baseName, $i)
            if ($f.FullName -ne $dest) { Move-Item -LiteralPath $f.FullName -Destination $dest -Force }
            $written.Add($dest)
            $i++
        }
        return $written
    }
    finally {
        if (Test-Path -LiteralPath $tmp) {
            try { Remove-Item -LiteralPath $tmp -Recurse -Force } catch {}
        }
    }
}

# ---- Main flow: auto-select backend ----------------------------------------
$result = $null
if (Find-PowerPoint) {
    $result = Render-WithPowerPoint
}
else {
    $soffice = Find-Soffice
    $pdftoppm = Find-Pdftoppm
    if ($soffice -and $pdftoppm) {
        $result = Render-WithLibreOffice -Soffice $soffice
    }
    else {
        $hint = @"
No usable rendering backend found. Pick one of two:
  (A) Install Microsoft PowerPoint (MS Office) -- preferred on Windows, no extra components needed
  (B) Cross-platform option, install both:
      winget install TheDocumentFoundation.LibreOffice
      winget install oschwartz10612.Poppler
"@
        Fail $hint
    }
}

if (-not $result -or $result.Count -eq 0) {
    Fail "Rendering produced no PNG"
}

Write-Host ""
Write-Host "Wrote $($result.Count) PNG(s):" -ForegroundColor Green
foreach ($p in $result) { Write-Host "  $p" }
exit 0
