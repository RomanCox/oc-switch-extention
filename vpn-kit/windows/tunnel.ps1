# Поднимает туннель и держит его. Запускается задачей планировщика,
# руками его звать не нужно — для проверки есть check.ps1.

. "$PSScriptRoot\config.ps1"

$sshArgs = @(
    '-N'
    '-D', "127.0.0.1:$($Config.SocksPort)"
    '-L', "127.0.0.1:$($Config.HttpPort):127.0.0.1:$($Config.RemoteProxyPort)"
    '-p', $Config.SshPort
    '-o', 'ServerAliveInterval=30'
    '-o', 'ServerAliveCountMax=3'
    '-o', 'ExitOnForwardFailure=yes'
    '-o', 'StrictHostKeyChecking=accept-new'
    '-o', 'BatchMode=yes'
)

if ($Config.KeyPath) { $sshArgs += @('-i', $Config.KeyPath) }
$sshArgs += "$($Config.User)@$($Config.Server)"

# Внешний цикл: ssh выходит при разрыве, мы поднимаем заново.
# Планировщик тоже перезапустит задачу, если процесс умрёт совсем.
while ($true) {
    & ssh.exe @sshArgs
    Start-Sleep -Seconds 5
}
