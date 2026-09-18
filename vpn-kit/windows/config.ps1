# Единственный файл, который нужно редактировать.
# Остальные скрипты читают значения отсюда.

$Config = @{
    # Пользователь и адрес сервера
    User   = 'tunnel'
    Server = 'admin.romancox.dev'

    # SSH-порт сервера
    SshPort = 22

    # Локальные порты. Менять не обязательно.
    SocksPort = 11080   # SOCKS5 — браузер, IDE, приложения
    HttpPort  = 11081   # HTTP   — Claude CLI и консольные инструменты

    # Порт tinyproxy на сервере (см. server/tinyproxy.conf)
    RemoteProxyPort = 8888

    # Приватный ключ, без .pub. Пустая строка — ключ по умолчанию из ~/.ssh
    KeyPath = "$env:USERPROFILE\.ssh\id_ed25519_ocswitch"
}
