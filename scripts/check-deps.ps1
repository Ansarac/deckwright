#requires -Version 5.1
<#
.SYNOPSIS
    deckwright dependency checker

.DESCRIPTION
    Checks whether this machine has everything the workflow needs --
    "generate .pptx + diagrams + visual QA loop" -- and for any missing item
    prints the exact install command to copy.

    Covers: Git, Node, npm; a render backend (PowerPoint COM or LibreOffice +
    Poppler); the npm packages; the Playwright Chromium browser; the official
    `pptx` skill plugin (a declared dependency -- NOT vendored, since Anthropic's
    license forbids copying it into a repo); this repo's own skills; and the
    open fonts (Poppins / Roboto Mono, optional but recommended).

    Design principle: this script uses only built-in PowerShell capabilities
    and does **not** depend on Node/Python -- because those are exactly what
    it is checking for; a bootstrap checker must have zero dependencies itself.
    All new checks are file / registry / JSON existence only (no Node/npm run).

    Only one of the two rendering backends is required:
      (A) Microsoft PowerPoint (MS Office) -- exports pptx to PNG directly via COM;
      (B) LibreOffice + Poppler           -- soffice converts to pdf, pdftoppm to png (cross-platform).
    Either one being available satisfies the loop requirement.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\check-deps.ps1
#>

$ErrorActionPreference = 'Stop'

# ---- Helpers ---------------------------------------------------------------
function Test-Cmd {
    param([string]$Name)
    $c = Get-Command $Name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source } else { return $null }
}

function Get-Ver {
    param([string]$Exe, [string[]]$VerArgs)
    try {
        $out = & $Exe @VerArgs 2>&1 | Select-Object -First 1
        return ($out | Out-String).Trim()
    } catch { return '' }
}

# LibreOffice is not added to PATH by default; probe common install paths too
function Find-Soffice {
    $p = Test-Cmd 'soffice'
    if ($p) { return $p }
    $candidates = @(
        "$env:ProgramFiles\LibreOffice\program\soffice.exe",
        "${env:ProgramFiles(x86)}\LibreOffice\program\soffice.exe"
    )
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

# Detect whether MS PowerPoint is installed via the registry ProgID (without launching it); returns the exe path or $null
function Find-PowerPoint {
    if (-not (Test-Path 'Registry::HKEY_CLASSES_ROOT\PowerPoint.Application')) { return $null }
    $ap = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\POWERPNT.EXE'
    if (Test-Path $ap) {
        $exe = (Get-ItemProperty $ap).'(default)'
        if ($exe -and (Test-Path $exe)) { return $exe }
    }
    return 'installed'   # ProgID exists but the exact path is unavailable; still treat as available
}

$results = New-Object System.Collections.Generic.List[object]
function Add-Result {
    param($Name, $Ok, $Detail, $Required, $Fix)
    $results.Add([pscustomobject]@{
        Name = $Name; Ok = $Ok; Detail = $Detail; Required = $Required; Fix = $Fix
    })
}

Write-Host ""
Write-Host "==== deckwright dependency check ====" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Git ----------------------------------------------------------------
$git = Test-Cmd 'git'
$gitDetail = if ($git) { Get-Ver 'git' @('--version') } else { 'not found' }
Add-Result 'Git' ([bool]$git) $gitDetail $true 'winget install Git.Git'

# ---- 2. Node.js (required) -------------------------------------------------
$node = Test-Cmd 'node'
$nodeOk = $false; $nodeDetail = 'not found'
if ($node) {
    $nodeDetail = Get-Ver 'node' @('--version')
    $m = [regex]::Match($nodeDetail, 'v(\d+)\.')
    if ($m.Success -and [int]$m.Groups[1].Value -ge 18) { $nodeOk = $true }
    else { $nodeDetail += '  (requires >= 18)' }
}
Add-Result 'Node.js (>=18)' $nodeOk $nodeDetail $true 'winget install OpenJS.NodeJS.LTS'

# ---- 3. npm (ships with Node) ----------------------------------------------
$npm = Test-Cmd 'npm'
$npmDetail = if ($npm) { Get-Ver 'npm' @('--version') } else { 'not found' }
Add-Result 'npm' ([bool]$npm) $npmDetail $true 'installed together with Node.js'

# ---- 4. Rendering backend (only one needed) --------------------------------
$ppt      = Find-PowerPoint
$soffice  = Find-Soffice
$pdftoppm = Test-Cmd 'pdftoppm'

$renderOk = $false
$renderDetail = ''
if ($ppt) {
    $renderOk = $true
    $loc = if ($ppt -eq 'installed') { '(installed)' } else { $ppt }
    $renderDetail = "Microsoft PowerPoint -- COM export to PNG  $loc"
} elseif ($soffice -and $pdftoppm) {
    $renderOk = $true
    $renderDetail = "LibreOffice + Poppler  ($soffice)"
} elseif ($soffice -and -not $pdftoppm) {
    $renderDetail = "Found LibreOffice but Poppler is missing; or switch to MS PowerPoint"
} else {
    $renderDetail = "No usable rendering backend found (PowerPoint or LibreOffice+Poppler)"
}
$renderFix = @"
Rendering backend -- pick one of two:
  (A) Install/already have Microsoft PowerPoint (MS Office) -- preferred for Windows users, no extra components needed
  (B) Cross-platform option, install both:
      winget install TheDocumentFoundation.LibreOffice
      winget install oschwartz10612.Poppler
"@
Add-Result 'Render backend (PPT/LO)' $renderOk $renderDetail $true $renderFix

# ---- 5. Python (optional) --------------------------------------------------
$py = Test-Cmd 'python'
if (-not $py) { $py = Test-Cmd 'py' }
$pyDetail = if ($py) { Get-Ver $py @('--version') } else { 'not found (optional, does not affect MVP)' }
Add-Result 'Python (>=3.9, optional)' ([bool]$py) $pyDetail $false 'winget install Python.Python.3.12'

# ---- Repo root (this script lives in scripts/) -----------------------------
$repoRoot = Split-Path -Parent $PSScriptRoot

# ---- 6. npm packages (diagram + build pipeline) ----------------------------
# File-existence only -- still zero-dependency (we do NOT run node/npm here).
$pkgs = @('pptxgenjs', 'sharp', 'lucide-static', 'playwright', 'mermaid', 'roughjs')
$nm = Join-Path $repoRoot 'node_modules'
$missingPkgs = @()
if (Test-Path $nm) {
    foreach ($pkg in $pkgs) { if (-not (Test-Path (Join-Path $nm $pkg))) { $missingPkgs += $pkg } }
} else { $missingPkgs = $pkgs }
$pkgsOk = ($missingPkgs.Count -eq 0)
$pkgsDetail = if ($pkgsOk) { "all present" } elseif (Test-Path $nm) { "missing: $($missingPkgs -join ', ')" } else { 'node_modules not found' }
Add-Result 'npm packages' $pkgsOk $pkgsDetail $true 'npm install'

# ---- 7. Playwright Chromium (offline diagram rendering) --------------------
$pwCache = Join-Path $env:LOCALAPPDATA 'ms-playwright'
$chromium = $false
if (Test-Path $pwCache) {
    $chromium = [bool](Get-ChildItem $pwCache -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'chromium*' })
}
$chromiumDetail = if ($chromium) { 'installed' } else { 'not found' }
Add-Result 'Playwright Chromium' $chromium $chromiumDetail $true 'npx playwright install chromium'

# ---- 8. Official pptx skill (the build toolchain, installed as a plugin) ----
# We do NOT vendor it -- Anthropic's license forbids copying it into a repo.
# It is a declared dependency: verify it is installed via the plugin cache.
$pluginCache = Join-Path $env:USERPROFILE '.claude\plugins\cache\anthropic-agent-skills\document-skills'
$installedJson = Join-Path $env:USERPROFILE '.claude\plugins\installed_plugins.json'
$pptxSkill = (Test-Path $pluginCache)
if (-not $pptxSkill -and (Test-Path $installedJson)) {
    try { $pptxSkill = ((Get-Content $installedJson -Raw) -match 'anthropic-agent-skills') } catch {}
}
$pptxDetail = if ($pptxSkill) { 'document-skills (pptx) installed' } else { 'not found' }
Add-Result 'Official pptx skill (plugin)' $pptxSkill $pptxDetail $true 'In Claude Code, run: /plugin install document-skills@anthropic-agent-skills'

# ---- 9. Workspace skills (shipped in this repo) ----------------------------
$ownSkills = @('slide-designer', 'theme-extractor', 'diagram-maker')
$missingSkills = @()
foreach ($sk in $ownSkills) {
    if (-not (Test-Path (Join-Path $repoRoot ".claude\skills\$sk\SKILL.md"))) { $missingSkills += $sk }
}
$skillsOk = ($missingSkills.Count -eq 0)
$skillsDetail = if ($skillsOk) { "all present ($($ownSkills -join ', '))" } else { "missing: $($missingSkills -join ', ')" }
Add-Result 'Workspace skills' $skillsOk $skillsDetail $true 'Repo incomplete -- restore .claude/skills (re-clone)'

# ---- 10. Fonts (optional; for faithful rendering of the Dev-Doc theme) ------
function Test-FontInstalled {
    param([string]$Match)
    $hives = @('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts',
        'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts')
    foreach ($h in $hives) {
        if (Test-Path $h) {
            $p = Get-ItemProperty $h -ErrorAction SilentlyContinue
            if ($p) { foreach ($n in $p.PSObject.Properties.Name) { if ($n -like "*$Match*") { return $true } } }
        }
    }
    return $false
}
$poppins = Test-FontInstalled 'Poppins'
$robotoMono = Test-FontInstalled 'Roboto Mono'
$fontsOk = ($poppins -and $robotoMono)
$fontsDetail = "Poppins: $(if ($poppins) {'yes'} else {'no'}); Roboto Mono: $(if ($robotoMono) {'yes'} else {'no'})"
Add-Result 'Fonts (Poppins + Roboto Mono)' $fontsOk $fontsDetail $false 'Install the open fonts (OFL / Apache-2.0) per-user for pixel-faithful rendering'

# ---- Output ----------------------------------------------------------------
foreach ($r in $results) {
    if ($r.Ok)            { $mark = '[OK] ';     $color = 'Green' }
    elseif ($r.Required)  { $mark = '[MISSING]'; $color = 'Red' }
    else                  { $mark = '[OPT] ';    $color = 'Yellow' }
    Write-Host ("  {0,-9} {1,-30} {2}" -f $mark, $r.Name, $r.Detail) -ForegroundColor $color
}

$missingRequired = $results | Where-Object { -not $_.Ok -and $_.Required }
$missingOptional = $results | Where-Object { -not $_.Ok -and -not $_.Required }

Write-Host ""
if ($missingRequired) {
    Write-Host "Missing required dependencies; install them following the guidance below:" -ForegroundColor Red
    Write-Host ""
    foreach ($r in $missingRequired) {
        Write-Host ("  # {0}" -f $r.Name) -ForegroundColor DarkGray
        Write-Host ("  {0}" -f $r.Fix) -ForegroundColor White
        Write-Host ""
    }
    Write-Host "  After installing, reopen the terminal (to refresh PATH) and run this script again to confirm." -ForegroundColor DarkGray
} else {
    Write-Host "All required dependencies are ready." -ForegroundColor Green
}

if ($missingOptional) {
    Write-Host ""
    Write-Host "Optional (enhances capabilities, not required):" -ForegroundColor Yellow
    foreach ($r in $missingOptional) {
        Write-Host ("  {0,-30} {1}" -f $r.Name, $r.Fix) -ForegroundColor DarkGray
    }
}

Write-Host ""
# Exit non-zero if required deps are missing, to make CI / automation checks easy
if ($missingRequired) { exit 1 } else { exit 0 }
