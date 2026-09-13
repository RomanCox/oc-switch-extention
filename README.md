# ocswitch

VPN только внутри браузера: переключатель на четыре режима для Chrome и Firefox.

## 1. Поднять туннель

Windows:

    .\tunnel\start-tunnel.ps1 -User <user> -Host admin.romancox.dev

macOS и Linux:

    ./tunnel/start-tunnel.sh <user> admin.romancox.dev

Окно должно остаться открытым. Проверка из другого окна:

    curl.exe --socks5-hostname 127.0.0.1:11080 https://ifconfig.me
    curl.exe https://ifconfig.me

Адреса должны отличаться.

## 2. Собрать расширение

    npm install
    npm test
    npm run build

## 3. Установить

Chrome: `chrome://extensions` → Режим разработчика → Загрузить распакованное →
папка `dist/chrome`.

Firefox: `about:debugging` → Этот Firefox → Загрузить временное дополнение →
файл `dist/firefox/manifest.json`.
