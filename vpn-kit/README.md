# vpn-kit

Один SSH-туннель, который даёт сразу два локальных прокси:

    127.0.0.1:11080   SOCKS5   браузер, IDE, приложения
    127.0.0.1:11081   HTTP     Claude CLI и консольные инструменты

Поднимается при входе в систему, без окон, переживает обрывы связи.
Система при этом остаётся на домашнем канале: через VPN идёт только то,
что вы явно настроили.

Работает на Windows, Linux и macOS — выберите свой раздел на шагах 3–4
и в разделах «Проверка» / «Удалить» ниже. Всё остальное (сервер, ключ,
`APPS.md`) от платформы не зависит.

---

## 0. Выключить системный openconnect

Обязательное условие. Пока он держит маршрут по умолчанию, состояния
«мимо VPN» не существует, и ничего из этого комплекта не имеет смысла.

Отключить, убрать из автозапуска. Проверить, что шлюз по умолчанию
указывает на физический адаптер, а не на VPN:

    Windows:       route print 0.0.0.0
    Linux:         ip route get 1.1.1.1
    macOS:         route get 1.1.1.1

---

## 1. Сервер: tinyproxy

Скопировать два файла и запустить:

    scp server/tinyproxy.conf server/setup-tinyproxy.sh USER@admin.romancox.dev:~
    ssh USER@admin.romancox.dev
    sudo bash setup-tinyproxy.sh

Скрипт поставит tinyproxy, положит конфиг, включит автозапуск и проверит,
что прокси слушает ТОЛЬКО 127.0.0.1 и отвечает. Если он слушает внешний
интерфейс — скрипт остановится с ошибкой.

Наружу ничего не открывается: попасть в tinyproxy можно только изнутри
сервера, то есть только через SSH.

---

## 2. Ключ

Автозапуску (планировщик, systemd, launchd) негде ввести пароль,
поэтому нужен ключ **без парольной фразы**:

    ssh-keygen -t ed25519 -C ocswitch -f ~/.ssh/id_ed25519_ocswitch
    cat ~/.ssh/id_ed25519_ocswitch.pub | ssh USER@admin.romancox.dev "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

На Windows в PowerShell путь к ключу — `$env:USERPROFILE\.ssh\id_ed25519_ocswitch`,
команда `cat` тоже работает (алиас `Get-Content`).

Проверить:

    ssh -o BatchMode=yes -i ~/.ssh/id_ed25519_ocswitch USER@admin.romancox.dev echo ok

Должно напечатать `ok` без запроса пароля.

---

## 3. Установка

Сначала впишите пользователя и сервер в файл конфигурации:

    Windows:        windows\config.ps1
    Linux, macOS:   unix/config.sh

Затем запустите установщик для своей платформы:

    Windows:

        cd windows
        .\install.ps1

    Linux:

        ./linux/install.sh

    macOS:

        ./macos/install.sh

Скрипт проверит вход по ключу и поставит фоновую службу:

    Windows:   задача планировщика ocswitch-tunnel
    Linux:     systemd --user сервис ocswitch-tunnel
    macOS:     launchd-агент dev.romancox.ocswitch-tunnel

Во всех трёх случаях: запуск при входе в систему, без окна, перезапуск
при сбое, без лимита времени выполнения. На headless-Linux (сервер без
постоянной десктоп-сессии, например по SSH) `install.sh` сам включит
`linger`, чтобы сервис пережил выход из сессии; если не получится —
подскажет команду для `sudo`.

---

## 4. Claude CLI

    Windows:        .\claude\apply-settings.ps1
    Linux, macOS:   ./claude/apply-settings.sh

Добавит `HTTPS_PROXY` в `~/.claude/settings.json`, не затирая остальное
(прежний файл сохранится как `.bak`).

Работает из любого терминала: WebStorm, PyCharm, Git Bash, Warp, cmd,
PowerShell, обычный shell. Настройка HTTP Proxy внутри IDE на встроенный
терминал НЕ влияет — поэтому настраиваем через `settings.json`.

Проверить: запустить `claude` заново, набрать `/status`, посмотреть
строку **Proxy**.

---

## 5. Остальные приложения

См. `APPS.md`.

---

## Проверка в любой момент

    Windows:        .\windows\check.ps1
    Linux, macOS:   ./unix/check.sh

Показывает, слушают ли оба порта, и три внешних адреса: напрямую,
через SOCKS5, через HTTP. Первый должен отличаться от двух остальных.

---

## Удалить

    Windows:        .\windows\uninstall.ps1
    Linux:           ./linux/uninstall.sh
    macOS:           ./macos/uninstall.sh

Убирает службу и гасит туннель. Настройки приложений не трогает.

---

## Если что-то не работает

Windows:

    Get-ScheduledTaskInfo -TaskName ocswitch-tunnel     # код последнего запуска
    .\windows\check.ps1                                  # что живо
    powershell -File .\windows\tunnel.ps1                # руками, с выводом ошибок

Linux:

    systemctl --user status ocswitch-tunnel              # состояние и последние строки лога
    journalctl --user -u ocswitch-tunnel -f               # лог целиком
    ./unix/check.sh                                        # что живо
    ./unix/tunnel.sh                                        # руками, с выводом ошибок

macOS:

    launchctl print gui/$(id -u)/dev.romancox.ocswitch-tunnel   # состояние
    tail -f ~/Library/Logs/ocswitch-tunnel*.log                  # лог
    ./unix/check.sh                                                # что живо
    ./unix/tunnel.sh                                                # руками, с выводом ошибок

Ручной запуск (`tunnel.ps1` / `tunnel.sh`) — самый полезный вариант:
служба прячет вывод ssh, а здесь видно причину (отказ по ключу,
недоступный хост, занятый порт).
