# Build djie-core untuk Windows (ARM64 + x64) dan buat binding C#.
# Jalankan di Windows: powershell -ExecutionPolicy Bypass -File scripts\build-core-windows.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$core = Join-Path $root "core"
$app = Join-Path $root "apps\windows\DjieShell"
$cargo = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
if (-not (Test-Path $cargo)) { $cargo = "cargo" }

Push-Location $core
foreach ($t in @("aarch64-pc-windows-msvc", "x86_64-pc-windows-msvc")) {
    & $cargo build --release --lib --target $t
    if ($LASTEXITCODE -ne 0) { throw "cargo build $t gagal" }
}
Pop-Location

# Binding C# (uniffi-bindgen-cs harus sesuai versi uniffi di core: 0.32)
$bindgen = Join-Path $env:USERPROFILE ".cargo\bin\uniffi-bindgen-cs.exe"
if (-not (Test-Path $bindgen)) {
    & $cargo install uniffi-bindgen-cs --git https://github.com/NordSecurity/uniffi-bindgen-cs --tag "v0.12.0+v0.32.0"
}
$gen = Join-Path $app "Core\Generated"
New-Item -ItemType Directory -Force $gen | Out-Null
& $bindgen --library (Join-Path $core "target\aarch64-pc-windows-msvc\release\djie_core.dll") --out-dir $gen
if ($LASTEXITCODE -ne 0) { throw "uniffi-bindgen-cs gagal" }

# DLL native per arsitektur
foreach ($pair in @(@("arm64", "aarch64-pc-windows-msvc"), @("x64", "x86_64-pc-windows-msvc"))) {
    $dst = Join-Path $app ("Native\" + $pair[0]); New-Item -ItemType Directory -Force $dst | Out-Null
    Copy-Item (Join-Path $core ("target\" + $pair[1] + "\release\djie_core.dll")) $dst -Force
}
Write-Output "OK: djie_core.dll + binding C# siap"
