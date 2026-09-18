# Добавляет HTTPS_PROXY в ~/.claude/settings.json, не затирая остальное.

. "$PSScriptRoot\..\windows\config.ps1"

$path = Join-Path $env:USERPROFILE '.claude\settings.json'
$dir  = Split-Path $path -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

if (Test-Path $path) {
    Copy-Item $path "$path.bak" -Force
    $json = Get-Content $path -Raw | ConvertFrom-Json
} else {
    $json = [PSCustomObject]@{}
}

if (-not $json.PSObject.Properties['env']) {
    $json | Add-Member -NotePropertyName env -NotePropertyValue ([PSCustomObject]@{})
}

$proxy = "http://127.0.0.1:$($Config.HttpPort)"
if ($json.env.PSObject.Properties['HTTPS_PROXY']) {
    $json.env.HTTPS_PROXY = $proxy
} else {
    $json.env | Add-Member -NotePropertyName HTTPS_PROXY -NotePropertyValue $proxy
}

$json | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8

Write-Host "Готово: $path" -ForegroundColor Green
Write-Host "HTTPS_PROXY = $proxy"
Write-Host ""
Write-Host "Перезапустите claude и проверьте /status — строку Proxy." -ForegroundColor DarkGray
