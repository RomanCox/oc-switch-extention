# Ставит задачу в планировщик: туннель поднимается при входе в систему,
# без окна, с перезапуском при сбое.
#
#   .\windows\install.ps1
#
# Перед запуском проверьте windows\config.ps1.

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\config.ps1"

$TaskName = 'ocswitch-tunnel'

if ($Config.User -eq 'CHANGE_ME') {
    Write-Host "Сначала впишите User в config.ps1" -ForegroundColor Red
    exit 1
}

# --- проверка ключа -------------------------------------------------
# Поднимаем настоящий туннель на временном порту и смотрим, слушает ли он.
# Проверять ключ командой вроде 'echo ok' нельзя: ключ намеренно
# ограничен только пробросом портов и команды выполнять не может.

Write-Host "==> Проверяю вход по ключу" -ForegroundColor Cyan

$probePort = 11099
$probeArgs = @(
    '-N'
    '-D', "127.0.0.1:$probePort"
    '-o', 'BatchMode=yes'
    '-o', 'ConnectTimeout=10'
    '-o', 'ExitOnForwardFailure=yes'
    '-o', 'StrictHostKeyChecking=accept-new'
    '-p', $Config.SshPort
)
if ($Config.KeyPath) { $probeArgs += @('-i', $Config.KeyPath) }
$probeArgs += "$($Config.User)@$($Config.Server)"

$probe = Start-Process ssh.exe -ArgumentList $probeArgs -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5
$keyOk = [bool](Get-NetTCPConnection -State Listen -LocalPort $probePort -ErrorAction SilentlyContinue)
if ($probe -and -not $probe.HasExited) { Stop-Process -Id $probe.Id -Force -ErrorAction SilentlyContinue }

if (-not $keyOk) {
    Write-Host "    Туннель не поднялся." -ForegroundColor Red
    Write-Host "    Посмотрите причину:" -ForegroundColor Yellow
    Write-Host "      ssh -v -N -D 11080 -i '$($Config.KeyPath)' $($Config.User)@$($Config.Server)"
    exit 1
}
Write-Host "    OK" -ForegroundColor Green

# --- задача ---------------------------------------------------------
Write-Host "==> Регистрирую задачу '$TaskName'" -ForegroundColor Cyan

$vbs = Join-Path $PSScriptRoot 'tunnel.vbs'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description 'SSH-tunnel: SOCKS5 for apps and HTTP proxy for CLI' | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Host "    Задача создана и запущена" -ForegroundColor Green

Start-Sleep -Seconds 4
Write-Host ""
& "$PSScriptRoot\check.ps1"
