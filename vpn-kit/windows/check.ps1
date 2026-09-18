# Показывает, жив ли туннель и куда реально уходит трафик.

. "$PSScriptRoot\config.ps1"

function Test-ListenPort {
    param([int]$Port)
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return [bool]$conn
}

function Get-ExternalIp {
    param([string[]]$ProxyArgs = @())
    $args2 = @('-s', '--max-time', '12') + $ProxyArgs + @('https://ifconfig.me')
    $out = & curl.exe @args2 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) { return $null }
    return $out.Trim()
}

function Show-Value {
    param([string]$Label, $Value, [string]$OkColor = 'Cyan')
    if ($Value) {
        Write-Host ("  {0,-16}{1}" -f $Label, $Value) -ForegroundColor $OkColor
    } else {
        Write-Host ("  {0,-16}нет ответа" -f $Label) -ForegroundColor Red
    }
}

Write-Host ''
Write-Host '  ocswitch — состояние туннеля' -ForegroundColor White
Write-Host '  ----------------------------' -ForegroundColor DarkGray

$socksUp = Test-ListenPort -Port $Config.SocksPort
$httpUp  = Test-ListenPort -Port $Config.HttpPort

if ($socksUp) {
    Write-Host ("  SOCKS5  127.0.0.1:{0}  слушает" -f $Config.SocksPort) -ForegroundColor Green
} else {
    Write-Host ("  SOCKS5  127.0.0.1:{0}  НЕ слушает" -f $Config.SocksPort) -ForegroundColor Red
}
if ($httpUp) {
    Write-Host ("  HTTP    127.0.0.1:{0}  слушает" -f $Config.HttpPort) -ForegroundColor Green
} else {
    Write-Host ("  HTTP    127.0.0.1:{0}  НЕ слушает" -f $Config.HttpPort) -ForegroundColor Red
}

Write-Host ''

$direct = Get-ExternalIp
$socks  = $null
$http   = $null
if ($socksUp) { $socks = Get-ExternalIp -ProxyArgs @('--socks5-hostname', ("127.0.0.1:" + $Config.SocksPort)) }
if ($httpUp)  { $http  = Get-ExternalIp -ProxyArgs @('--proxy', ("http://127.0.0.1:" + $Config.HttpPort)) }

Show-Value -Label 'напрямую' -Value $direct -OkColor 'Gray'
Show-Value -Label 'через SOCKS5' -Value $socks
Show-Value -Label 'через HTTP' -Value $http

Write-Host ''

if ($socks -and $http -and $direct) {
    if ($socks -eq $direct) {
        Write-Host '  ВНИМАНИЕ: адреса совпадают.' -ForegroundColor Yellow
        Write-Host '  Скорее всего на машине включён системный VPN (openconnect).' -ForegroundColor Yellow
        Write-Host '  Выключите его — иначе "мимо VPN" не существует как состояние.' -ForegroundColor Yellow
    } elseif ($socks -eq $http) {
        Write-Host '  Всё в порядке: оба прокси выходят через сервер, система — напрямую.' -ForegroundColor Green
    } else {
        Write-Host '  SOCKS и HTTP дают разные адреса. Проверьте tinyproxy на сервере.' -ForegroundColor Yellow
    }
} elseif (-not $socksUp -and -not $httpUp) {
    Write-Host '  Туннель не поднят.' -ForegroundColor Red
    Write-Host '    Start-ScheduledTask -TaskName ocswitch-tunnel' -ForegroundColor DarkGray
    Write-Host '    Get-ScheduledTaskInfo -TaskName ocswitch-tunnel' -ForegroundColor DarkGray
}
Write-Host ''
