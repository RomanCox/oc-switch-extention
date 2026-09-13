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

Список правил: `jira.corp.example.com`, `*.internal.example.com`

| хост                       | off    | all    | include | exclude |
|----------------------------|--------|--------|---------|---------|
| jira.corp.example.com      | DIRECT | PROXY  | PROXY   | DIRECT  |
| wiki.internal.example.com  | DIRECT | PROXY  | PROXY   | DIRECT  |
| github.com                 | DIRECT | PROXY  | DIRECT  | PROXY   |
| 127.0.0.1                  | DIRECT | DIRECT | DIRECT  | DIRECT  |
| localhost                  | DIRECT | DIRECT | DIRECT  | DIRECT  |
| printer.local              | DIRECT | DIRECT | DIRECT  | DIRECT  |

## Фаза 2 — Chrome MVP

- [ ] service worker: `off` → `proxy.settings.clear()`, иначе `pac_script`
- [ ] попап: сегментированный переключатель на четыре положения
- [ ] состояние в `storage.local`
- [ ] восстановление режима на `onStartup` и `onInstalled`
- [ ] бейдж с текущим режимом
- [ ] сборка `npm run build` кладёт готовое расширение в `dist/chrome`

Готово, когда: на ifconfig.me видно переключение IP между `off` и `all`
без перезапуска браузера.

## Фаза 3 — редактор списка

- [ ] страница опций: правило на строку, живая валидация
- [ ] кнопка «+ текущий домен» в попапе
- [ ] импорт и экспорт JSON
- [ ] в попапе показывать, какое правило сматчило текущий хост

## Фаза 4 — Firefox

- [ ] адаптер `proxy.onRequest`, вызывающий тот же `decide()`
- [ ] `proxyDNS: true`
- [ ] `browser_specific_settings.gecko.id`
- [ ] работа в приватных окнах

## Фаза 5 — надёжность

- [ ] индикатор живости туннеля (проба через прокси), цвет бейджа
- [ ] проверка `levelOfControl`, предупреждение о конфликте расширений
- [ ] `webRTCIPHandlingPolicy: "disable_non_proxied_udp"` в `all` и `exclude`
- [ ] инкогнито: `scope: "incognito_persistent"`
- [ ] fail-closed при мёртвом туннеле: не откатываться в DIRECT молча

## Фаза 6 — упаковка

- [ ] zip для Chrome, xpi с unlisted-подписью AMO для Firefox
- [ ] скрипты запуска туннеля для macOS и Linux
- [ ] README для чистой машины
