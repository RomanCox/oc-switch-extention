import { decide, DEFAULT_SETTINGS, isRemoteNewer, pullRules, type Settings } from '../../core/src/index.js';

/**
 * Firefox-адаптер. PAC не нужен: onRequest вызывает decide() напрямую,
 * поэтому обе реализации здесь заведомо совпадают.
 *
 * Тип browser описан вручную (а не через @types/chrome), потому что
 * proxy.onRequest — API, которого в chrome.* вообще нет, а остальные
 * методы здесь нужны в promise-варианте, который есть у настоящего
 * WebExtensions browser.*.
 */
declare const browser: {
  proxy: {
    onRequest: {
      addListener(fn: (req: { url: string }) => unknown, filter: { urls: string[] }): void;
    };
  };
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
    onChanged: {
      addListener(fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
    };
  };
  runtime: {
    onStartup: { addListener(fn: () => void): void };
    onInstalled: { addListener(fn: () => void): void };
  };
  alarms: {
    create(name: string, info: { periodInMinutes: number }): void;
    onAlarm: { addListener(fn: (alarm: { name: string }) => void): void };
  };
};

const STORAGE_KEY = 'settings';
const SYNC_ALARM = 'ocswitch-sync-pull';
const SYNC_PERIOD_MINUTES = 15;

let current: Settings = DEFAULT_SETTINGS;

async function loadSettings(): Promise<Settings> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEY] as Partial<Settings> | undefined) };
}

async function restore(): Promise<void> {
  current = await loadSettings();
}

/**
 * Подтягивает правила с сервера синхронизации, если он настроен и включён.
 * Применяет только если серверная версия свежее локальной («побеждает
 * последний»); onChanged сам обновит `current`.
 */
async function syncPull(): Promise<void> {
  const settings = current;
  if (!settings.sync.enabled || !settings.sync.url || !settings.sync.token) return;
  try {
    const remote = await pullRules({ url: settings.sync.url, token: settings.sync.token });
    const local = { rules: settings.rules, updatedAt: settings.rulesUpdatedAt };
    if (!isRemoteNewer(local, remote)) return;
    const next: Settings = { ...settings, rules: remote.rules, rulesUpdatedAt: remote.updatedAt };
    await browser.storage.local.set({ [STORAGE_KEY]: next });
  } catch (err) {
    console.error('ocswitch: синхронизация не удалась', err);
  }
}

async function restoreAndSync(): Promise<void> {
  await restore();
  void syncPull();
}

browser.runtime.onStartup.addListener(() => void restoreAndSync());
browser.runtime.onInstalled.addListener(() => void restoreAndSync());
void restoreAndSync();

browser.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) void syncPull();
});

// Попап и options ничего не знают про proxy.* — они только пишут
// в storage.local, а сюда прилетает onChanged и обновляет current.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  current = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue as Partial<Settings> | undefined) };
});

browser.proxy.onRequest.addListener(
  (req) => {
    const host = new URL(req.url).hostname;
    if (decide(host, current) === 'DIRECT') return { type: 'direct' };
    return {
      type: 'socks',
      host: current.proxy.host,
      port: current.proxy.port,
      // без этого Firefox резолвит имена локально и DNS утекает мимо туннеля
      proxyDNS: true,
    };
  },
  { urls: ['<all_urls>'] },
);
