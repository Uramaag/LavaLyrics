# LavaLyrics C++ Build Script
# Run this after Qt6 + MinGW are installed via the Qt installer
# Usage: .\build.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== LavaLyrics C++ Build ===" -ForegroundColor Cyan

# ── 1. Find Qt6 installation ──────────────────────────────────────────────────
$qtBase = $null
$searchRoots = @("C:\Qt", "$env:USERPROFILE\Qt", "D:\Qt")

foreach ($root in $searchRoots) {
    if (Test-Path $root) {
        # Find latest Qt6 version with MinGW
        $found = Get-ChildItem $root -Directory | Where-Object { $_.Name -match "^6\." } |
                 Sort-Object Name -Descending | Select-Object -First 1
        if ($found) {
            $mingwDir = Get-ChildItem $found.FullName -Directory |
                        Where-Object { $_.Name -match "mingw" } | Select-Object -First 1
            if ($mingwDir) {
                $qtBase = $mingwDir.FullName
                break
            }
        }
    }
}

if (-not $qtBase) {
    Write-Host "ERROR: Qt6 MinGW not found!" -ForegroundColor Red
    Write-Host "Install Qt6 with MinGW via the Qt installer first."
    Write-Host "Expected paths like: C:\Qt\6.7.3\mingw_64"
    exit 1
}

Write-Host "Found Qt6 at: $qtBase" -ForegroundColor Green

# ── 2. Find MinGW compiler ────────────────────────────────────────────────────
$mingwTools = Get-ChildItem "C:\Qt\Tools" -Directory -ErrorAction SilentlyContinue |
              Where-Object { $_.Name -match "mingw" } | Sort-Object Name -Descending | Select-Object -First 1

if (-not $mingwTools) {
    # Try Qt root Tools folder
    $qtRoot = Split-Path (Split-Path $qtBase)
    $mingwTools = Get-ChildItem "$qtRoot\Tools" -Directory -ErrorAction SilentlyContinue |
                  Where-Object { $_.Name -match "mingw" } | Sort-Object Name -Descending | Select-Object -First 1
}

if ($mingwTools) {
    $mingwBin = "$($mingwTools.FullName)\bin"
    Write-Host "Found MinGW at: $mingwBin" -ForegroundColor Green
    $env:PATH = "$mingwBin;$env:PATH"
} else {
    Write-Host "WARNING: MinGW tools not found in Qt/Tools. Make sure g++.exe is in PATH." -ForegroundColor Yellow
}

# ── 3. Set CMAKE_PREFIX_PATH ──────────────────────────────────────────────────
$env:CMAKE_PREFIX_PATH = $qtBase
Write-Host "CMAKE_PREFIX_PATH = $qtBase"

# ── 4. Create build directory ─────────────────────────────────────────────────
$buildDir = "build-release"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

# ── 5. CMake configure ────────────────────────────────────────────────────────
Write-Host "`n--- Configuring with CMake ---" -ForegroundColor Cyan
cmake -B $buildDir -S . `
    -G "MinGW Makefiles" `
    -DCMAKE_BUILD_TYPE=Release `
    "-DCMAKE_PREFIX_PATH=$qtBase" `
    -DLAVA_USE_FFMPEG=OFF

if ($LASTEXITCODE -ne 0) {
    Write-Host "CMake configure FAILED" -ForegroundColor Red
    exit 1
}

# ── 6. Build ──────────────────────────────────────────────────────────────────
Write-Host "`n--- Building ---" -ForegroundColor Cyan
$cores = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
cmake --build $buildDir --config Release -j $cores

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build FAILED" -ForegroundColor Red
    exit 1
}

# ── 7. Deploy Qt DLLs ────────────────────────────────────────────────────────
Write-Host "`n--- Deploying Qt DLLs ---" -ForegroundColor Cyan
$exePath = "dist\LavaLyrics.exe"
$windeployqt = "$qtBase\bin\windeployqt.exe"

if (Test-Path $windeployqt) {
    & $windeployqt --qmldir src\qml --release $exePath
    Write-Host "windeployqt done" -ForegroundColor Green
} else {
    Write-Host "WARNING: windeployqt not found at $windeployqt" -ForegroundColor Yellow
}

# ── 8. Copy MinGW runtime DLLs ───────────────────────────────────────────────
if ($mingwBin) {
    $runtimeDlls = @("libgcc_s_seh-1.dll", "libstdc++-6.dll", "libwinpthread-1.dll")
    foreach ($dll in $runtimeDlls) {
        $src = "$mingwBin\$dll"
        if (Test-Path $src) {
            Copy-Item $src "dist\" -Force
            Write-Host "Copied $dll" -ForegroundColor Gray
        }
    }
}

Write-Host "`n=== BUILD COMPLETE ===" -ForegroundColor Green
Write-Host "Executable: dist\LavaLyrics.exe" -ForegroundColor Cyan

# Open dist folder
explorer dist
