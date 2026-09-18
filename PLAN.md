# План сборки ocswitch

## Фаза 0 — туннель. ГОТОВО

    ssh -D 11080 -N user@admin.romancox.dev

Проверено: `curl --socks5-hostname 127.0.0.1:11080 https://ifconfig.me`
возвращает IP сервера, прямой запрос — домашний IP.

Docker, openconnect и ocproxy не понадобились. На macOS и Linux команда та же.

## Фаза 1 — пакет core

- [ ] типы: `Mode`, `Rule`, `Settings`, `Verdict`
- [ ] `matchHost()` — точное совпадение, `*.example.com`, домен и поддомены
- [ ] `decide()` — включая безусловный обход для localhost и `*.local`
- [ ] `buildPacScript()` — генерирует PAC с зашитым списком правил
- [ ] тесты по таблице решений ниже
- [ ] тест-близнец: прогон сгенерированного PAC и сверка с `decide()`

Готово, когда: `npm test` зелёный, включая тест-близнец.

### Таблица решений

Обновлена в фазе 3.1 (см. ниже) — правило теперь принадлежит одному из двух
списков (`+VPN` / `−VPN`) и имеет силу `force` (побеждает всегда) или
`soft` (участвует только в «своём» режиме). Актуальная таблица:

Правила: `jira.corp.example.com` (+VPN, soft), `force-proxy.example.com` (+VPN, force),
`*.internal.example.com` (−VPN, soft), `force-direct.example.com` (−VPN, force)

| хост                        | off    | all    | include | exclude |
|-----------------------------|--------|--------|---------|---------|
| jira.corp.example.com       | DIRECT | PROXY  | PROXY   | PROXY   |
| force-proxy.example.com     | PROXY  | PROXY  | PROXY   | PROXY   |
| wiki.internal.example.com   | DIRECT | PROXY  | DIRECT  | DIRECT  |
| force-direct.example.com    | DIRECT | DIRECT | DIRECT  | DIRECT  |
| github.com                  | DIRECT | PROXY  | DIRECT  | PROXY   |
| 127.0.0.1                   | DIRECT | DIRECT | DIRECT  | DIRECT  |
| localhost                   | DIRECT | DIRECT | DIRECT  | DIRECT  |
| printer.local               | DIRECT | DIRECT | DIRECT  | DIRECT  |

## Фаза 2 — Chrome MVP

- [ ] service worker: `off` → `proxy.settings.clear()`, иначе `pac_script`
- [ ] попап: сегментированный переключатель на четыре положения
- [ ] состояние в `storage.local`
- [ ] восстановление режима на `onStartup` и `onInstalled`
- [ ] бейдж с текущим режимом
- [ ] сборка `npm run build` кладёт готовое расширение в `dist/chrome`

Готово, когда: на ifconfig.me видно переключение IP между `off` и `all`
без перезапуска браузера.

## Фаза 3 — редактор списка. ГОТОВО

- [x] страница опций: правило на строку, живая валидация
- [x] кнопка «+ текущий домен» в попапе
- [x] импорт и экспорт JSON
- [x] в попапе показывать, какое правило сматчило текущий хост

## Фаза 3.1 — два списка вместо одного. ГОТОВО

Один список правил на два режима (include/exclude) оказался мало гибким:
не было способа сказать «этот хост всегда через VPN, даже если общий
режим off». Заменили на два независимых списка с двумя уровнями силы.

- [x] `Rule.list: 'proxy' | 'direct'` — список `+VPN` / `−VPN`
- [x] `Rule.strength: 'force' | 'soft'` — force побеждает в любом режиме
      (даже off/all), soft участвует только в «своём» режиме (include/exclude)
- [x] `decide()`: `ALWAYS_DIRECT` → force `+VPN` → force `−VPN` → режим
- [x] options: два списка вместо одного, синтаксис `!host` — force,
      `#host` — отключено
- [x] обновлена таблица решений и тест-близнец PAC/decide

## Фаза 3.2 — синхронизация через свой сервер. ГОТОВО

Каждый браузер/канал (Chrome, Chrome Dev, Chrome Canary, Opera, Firefox,
Firefox Dev) — отдельный `storage.local`. `storage.sync` не годится
(см. CLAUDE.md), поэтому сделали свой минимальный сервер.

- [x] `server/sync-server.mjs` — Node, без зависимостей, хранит
      `{ rules, updatedAt }` в JSON-файле, Bearer-токен, `GET`/`PUT /rules`
- [x] `core/src/sync.ts` — `pullRules`/`pushRules`/`isRemoteNewer`, только
      `fetch()`, без chrome/browser API
- [x] `Settings.sync: { url, token, enabled }`, `Settings.rulesUpdatedAt`
- [x] options: карточка «Синхронизация», «Сохранить» пушит, «Обновить
      сейчас» тянет немедленно и безусловно
- [x] background (Chrome и Firefox): pull при `onStartup`/`onInstalled`
      и по `alarms` (каждые 15 минут), конфликты — по `rulesUpdatedAt`
- [x] попутно закрыт долг фазы 4: Firefox-адаптер раньше вообще не читал
      `storage.local` (только `setSettings()`, который никто не вызывал) —
      теперь грузит и обновляет настройки как положено

## Фаза 4 — Firefox. ГОТОВО

- [x] адаптер `proxy.onRequest`, вызывающий тот же `decide()`
- [x] `proxyDNS: true`
- [x] `browser_specific_settings.gecko.id`
- [x] работа в приватных окнах

По приватным окнам — важное ограничение платформы, не баг: Firefox не даёт
расширению форсировать доступ к приватным окнам через манифест (в отличие
от Chrome, `"incognito": "spanning"` в Firefox не работает как автогрант).
Без ручного включения `browser.proxy.onRequest` для приватных окон вообще
не вызывается — трафик тихо идёт в обход всей логики `decide()`. Раз
закрыть это кодом нельзя, сделали то, что можно:

- попап проверяет `browser.extension.isAllowedIncognitoAccess()` и
  показывает предупреждение, если доступ не выдан
- пользователю нужно вручную зайти в `about:addons` → ocswitch → Подробнее →
  включить «Запускать в приватных окнах» (см. README)

Chrome/Opera эта проблема не касается: там прокси — PAC-скрипт на уровне
браузера (`chrome.proxy.settings`), приватные окна наследуют его без
дополнительного разрешения.

## Фаза 5 — надёжность

- [ ] индикатор живости туннеля (проба через прокси), цвет бейджа
- [ ] проверка `levelOfControl`, предупреждение о конфликте расширений
- [ ] `webRTCIPHandlingPolicy: "disable_non_proxied_udp"` в `all` и `exclude`
- [ ] инкогнито: `scope: "incognito_persistent"`
- [ ] fail-closed при мёртвом туннеле: не откатываться в DIRECT молча

## Фаза 6 — упаковка

- [ ] zip для Chrome, xpi с unlisted-подписью AMO для Firefox
- [x] скрипты запуска туннеля для macOS и Linux — `vpn-kit/unix`,
      `vpn-kit/linux`, `vpn-kit/macos` (systemd --user / launchd, фоновый
      автозапуск, как на Windows)
- [x] README для чистой машины — `vpn-kit/README.md` (Windows/Linux/macOS)
