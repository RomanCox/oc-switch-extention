param(
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Server,
  [int]$Port = 11080
)

# Держит SOCKS5-прокси на 127.0.0.1:$Port, пока окно открыто.
# Закрыть окно или Ctrl+C — туннель пропадёт.

Write-Host "SOCKS5 на 127.0.0.1:$Port -> $User@$Server" -ForegroundColor Cyan
Write-Host "Проверка из другого окна:" -ForegroundColor DarkGray
Write-Host "  curl.exe --socks5-hostname 127.0.0.1:$Port https://ifconfig.me" -ForegroundColor DarkGray
Write-Host ""

ssh -D $Port -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 "$User@$Server"
