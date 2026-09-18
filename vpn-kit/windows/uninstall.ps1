# Убирает задачу и останавливает туннель.
# Настройки приложений не трогает.

. "$PSScriptRoot\config.ps1"

$TaskName = 'ocswitch-tunnel'

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Гасим только наши ssh-процессы — те, в командной строке которых есть наш порт
$needle = "-D 127.0.0.1:$($Config.SocksPort)"
Get-CimInstance Win32_Process -Filter "Name = 'ssh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($needle) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host 'Задача удалена, туннель остановлен.' -ForegroundColor Green
Write-Host 'settings.json, ярлыки и расширение не тронуты.' -ForegroundColor DarkGray
