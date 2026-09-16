import { DEFAULT_SETTINGS, type Mode, type Settings } from '../core/src/index.js';

/**
 * Общий попап для Chrome и Firefox.
 *
 * Своей логики маршрутизации не имеет — только читает и пишет
 * storage.local. Применяет решение background каждого расширения
 * (Chrome — через onChanged → PAC, Firefox — через onChanged → decide()).
 */

declare const browser: typeof chrome | undefined;
const api: typeof chrome = typeof browser !== 'undefined' ? browser : chrome;

const STORAGE_KEY = 'settings';

const MODE_LABELS: Record<Mode, string> = {
  off: 'Мимо VPN',
  all: 'Всё через VPN',
  include: 'Список через VPN',
  exclude: 'Список мимо VPN',
};

const MODES = Object.keys(MODE_LABELS) as Mode[];

async function loadSettings(): Promise<Settings> {
  const raw = await api.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEY] as Partial<Settings> | undefined) };
}

async function saveMode(mode: Mode): Promise<void> {
  const settings = await loadSettings();
  await api.storage.local.set({ [STORAGE_KEY]: { ...settings, mode } satisfies Settings });
}

function renderStatus(mode: Mode): void {
  const status = document.getElementById('status');
  if (status) status.textContent = MODE_LABELS[mode];
}

function renderChecked(mode: Mode): void {
  for (const m of MODES) {
    const input = document.getElementById(`mode-${m}`);
    if (input instanceof HTMLInputElement) input.checked = m === mode;
  }
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  renderChecked(settings.mode);
  renderStatus(settings.mode);

  document.getElementById('modes')?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'mode') return;
    const mode = target.value as Mode;
    renderStatus(mode);
    void saveMode(mode);
  });

  // Список правил и матчинг текущего домена — фаза 3.
  const addButton = document.getElementById('add-current');
  if (addButton instanceof HTMLButtonElement) {
    addButton.disabled = true;
    addButton.title = 'Появится в фазе 3';
  }
}

void init();