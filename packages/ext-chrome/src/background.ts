import { buildPacScript, DEFAULT_SETTINGS, type Mode, type Settings } from '../../core/src/index.js';

/**
 * Chrome-адаптер. Своей логики маршрутизации не имеет:
 * всё решение приходит из core в виде PAC-скрипта.
 */

const STORAGE_KEY = 'settings';

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

async function restore(): Promise<void> {
  applySettings(await loadSettings());
}

// Service worker может выгружаться между событиями — состояние держит
// только storage.local, поэтому режим восстанавливается на каждом запуске.
chrome.runtime.onStartup.addListener(restore);
chrome.runtime.onInstalled.addListener(restore);
void restore();

// Попап ничего не знает про proxy.* — он только пишет в storage.local,
// а сюда прилетает onChanged и применяет решение.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  const next: Settings = {
    ...DEFAULT_SETTINGS,
    ...(changes[STORAGE_KEY].newValue as Partial<Settings> | undefined),
  };
  void applySettings(next);
});