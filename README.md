# ocswitch

VPN только внутри браузера: переключатель на четыре режима для Chrome и Firefox.

## 1. Поднять туннель

Фоновая установка для Windows, Linux и macOS — в `vpn-kit/README.md`.
Ставится один раз, поднимается сам при входе в систему, переживает
обрывы связи и заодно даёт HTTP-прокси для Claude CLI и консольных
инструментов.

Быстрая проверка после установки:

    .\vpn-kit\windows\check.ps1     # Windows
    ./vpn-kit/unix/check.sh         # Linux, macOS

Показывает внешний IP напрямую и через прокси — адреса должны отличаться.

## 2. Собрать расширение

    pnpm install
    pnpm test
    pnpm run build

## 3. Установить

Chrome: `chrome://extensions` → Режим разработчика → Загрузить распакованное →
папка `dist/chrome`.

Firefox: `about:debugging` → Этот Firefox → Загрузить временное дополнение →
файл `dist/firefox/manifest.json`.

Firefox, приватные окна — важно: по умолчанию Firefox **не** пускает
расширения в приватные окна, и это нельзя включить из кода расширения —
только вручную. Без этого шага вкладки в приватном окне идут в обход
VPN незаметно для вас. Один раз для постоянно установленного расширения:

`about:addons` → ocswitch → «Подробнее» → включить «Запускать в приватных
окнах». Попап покажет предупреждение, если это не включено.

## 4. Синхронизация списков между браузерами (опционально)

Один и тот же список правил можно использовать в нескольких браузерах
(Chrome, Chrome Dev/Canary, Opera, Firefox, Firefox Dev) — каждый подтягивает
и отправляет правила на ваш собственный сервер, без `storage.sync` и без
чужого облачного аккаунта.

На сервере (там же, где поднят туннель, или в любом другом месте):

    OCSWITCH_SYNC_TOKEN=<придумайте токен> pnpm run sync-server

По умолчанию слушает `:8790`, хранит правила в `server/rules.json`
(`OCSWITCH_SYNC_PORT` и `OCSWITCH_SYNC_FILE` — если нужно другое).

В каждом браузере: `options` → карточка «Синхронизация» → указать адрес
сервера и тот же токен → включить синхронизацию → «Сохранить». Дальше
любое «Сохранить» отправляет правила на сервер, а фон расширения сам
подтягивает изменения при старте и раз в 15 минут. Кнопка «Обновить
сейчас» подтягивает немедленно, не дожидаясь таймера.

### Постоянный запуск на сервере (systemd)

Ручной запуск командой живёт, пока открыт терминал — на сервере нужен демон,
который переживёт перезагрузку и сам поднимется после падения.

    ssh <user>@admin.romancox.dev
    sudo mkdir -p /opt/ocswitch && sudo chown $USER /opt/ocswitch
    git clone <репозиторий> /opt/ocswitch      # либо просто скопировать server/
    sudo useradd --system --no-create-home ocswitch

Файл с токеном отдельно от unit-файла и от git — `systemctl cat` показывает
unit кому угодно из `sudo`-группы, а `.env` с правами 600 нет:

    sudo tee /etc/ocswitch-sync.env >/dev/null <<'EOF'
    OCSWITCH_SYNC_TOKEN=<придумайте длинный токен>
    OCSWITCH_SYNC_PORT=8790
    EOF
    sudo chmod 600 /etc/ocswitch-sync.env
    sudo chown ocswitch:ocswitch /opt/ocswitch/server

Установить и включить unit (шаблон уже в репозитории —
`server/ocswitch-sync.service`):

    sudo cp /opt/ocswitch/server/ocswitch-sync.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now ocswitch-sync
    sudo systemctl status ocswitch-sync
    journalctl -u ocswitch-sync -f

Порт `8790` наружу лучше не светить: либо слушать только `127.0.0.1` и ходить
на него через тот же SSH-туннель (`ssh -L 8790:127.0.0.1:8790 ...`), либо
поставить перед ним nginx/caddy с TLS, если нужен доступ извне.
