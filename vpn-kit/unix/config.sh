# Единственный файл, который нужно редактировать на Linux и macOS.
# Остальные скрипты читают значения отсюда через `source`.

OCSWITCH_USER="tunnel"
OCSWITCH_SERVER="admin.romancox.dev"

# SSH-порт сервера
OCSWITCH_SSH_PORT=22

# Локальные порты. Менять не обязательно.
OCSWITCH_SOCKS_PORT=11080   # SOCKS5 — браузер, IDE, приложения
OCSWITCH_HTTP_PORT=11081    # HTTP   — Claude CLI и консольные инструменты

# Порт tinyproxy на сервере (см. ../server/tinyproxy.conf)
OCSWITCH_REMOTE_PROXY_PORT=8888

# Приватный ключ, без .pub. Пустая строка — ключ по умолчанию из ~/.ssh
OCSWITCH_KEY_PATH="$HOME/.ssh/id_ed25519_ocswitch"
