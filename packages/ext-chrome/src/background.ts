import { buildPacScript, DEFAULT_SETTINGS, type Settings } from '../../core/src/index.js';

/**
 * Chrome-адаптер. Своей логики маршрутизации не имеет:
 * всё решение приходит из core в виде PAC-скрипта.
 */

const STORAGE_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEY] as Partial<Settings> | undefined) };
}

export async function applySettings(settings: Settings): Promise<void> {
  if (settings.mode === 'off') {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    return;
  }
  await chrome.proxy.settings.set({
    scope: 'regular',
    value: {
      mode: 'pac_script',
      pacScript: { data: buildPacScript(settings) },
    },
  });
}

// TODO фаза 2: onStartup, onInstalled, storage.onChanged, бейдж.
