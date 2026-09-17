import {
  buildPacScript,
  DEFAULT_SETTINGS,
  isRemoteNewer,
  pullRules,
  type Mode,
  type Settings,
} from '../../core/src/index.js';

/**
 * Chrome-адаптер. Своей логики маршрутизации не имеет:
 * всё решение приходит из core в виде PAC-скрипта.
 */

const STORAGE_KEY = 'settings';
const SYNC_ALARM = 'ocswitch-sync-pull';
const SYNC_PERIOD_MINUTES = 15;

const BADGE_TEXT: Record<Mode, string> = {
  off: '',
  all: 'ALL',
  include: 'IN',
  exclude: 'EX',
};

const BADGE_COLOR: Record<Mode, string> = {
  off: '#9aa0a6',
  all: '#1a73e8',
  include: '#188038',
  exclude: '#e8710a',
};

export async function loadSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEY] as Partial<Settings> | undefined) };
}

export async function applySettings(settings: Settings): Promise<void> {
  if (settings.mode === 'off') {
    await chrome.proxy.settings.clear({ scope: 'regular' });
  } else {
    await chrome.proxy.settings.set({
      scope: 'regular',
      value: {
        mode: 'pac_script',
        pacScript: { data: buildPacScript(settings) },
      },
    });
  }
  await chrome.action.setBadgeText({ text: BADGE_TEXT[settings.mode] });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR[settings.mode] });
}

/**
 * Подтягивает правила с сервера синхронизации, если он настроен и включён.
 * Применяет только если серверная версия свежее локальной («побеждает
 * последний») — сохранение через onChanged пере-применит PAC само.
 */
async function syncPull(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.sync.enabled || !settings.sync.url || !settings.sync.token) return;
  try {
    const remote = await pullRules({ url: settings.sync.url, token: settings.sync.token });
    const local = { rules: settings.rules, updatedAt: settings.rulesUpdatedAt };
    if (!isRemoteNewer(local, remote)) return;
    const next: Settings = { ...settings, rules: remote.rules, rulesUpdatedAt: remote.updatedAt };
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } catch (err) {
    console.error('ocswitch: синхронизация не удалась', err);
  }
}

async function restore(): Promise<void> {
  await applySettings(await loadSettings());
  void syncPull();
}

// Service worker может выгружаться между событиями — состояние держит
// только storage.local, поэтому режим восстанавливается на каждом запуске.
chrome.runtime.onStartup.addListener(restore);
chrome.runtime.onInstalled.addListener(restore);
void restore();

chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) void syncPull();
});

// Попап и options ничего не знают про proxy.* — они только пишут
// в storage.local, а сюда прилетает onChanged и применяет решение.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  const next: Settings = {
    ...DEFAULT_SETTINGS,
    ...(changes[STORAGE_KEY].newValue as Partial<Settings> | undefined),
  };
  void applySettings(next);
});