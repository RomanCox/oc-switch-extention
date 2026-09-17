import {
  decide,
  DEFAULT_SETTINGS,
  findMatchingRule,
  pushRules,
  type Mode,
  type Rule,
  type Settings,
} from '../core/src/index.js';

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

let currentHost: string | null = null;

async function loadSettings(): Promise<Settings> {
  const raw = await api.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEY] as Partial<Settings> | undefined) };
}

async function saveSettings(settings: Settings): Promise<void> {
  await api.storage.local.set({ [STORAGE_KEY]: settings });
}

async function saveMode(mode: Mode): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, mode });
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

async function getActiveTabHost(): Promise<string | null> {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    return new URL(tab.url).hostname || null;
  } catch {
    return null;
  }
}

function renderHostInfo(host: string | null, settings: Settings): void {
  const nameEl = document.getElementById('host-name');
  const verdictEl = document.getElementById('host-verdict');
  if (!(nameEl instanceof HTMLElement) || !(verdictEl instanceof HTMLElement)) return;

  if (!host) {
    nameEl.textContent = '—';
    verdictEl.textContent = 'нет доступа к вкладке';
    verdictEl.className = 'verdict';
    return;
  }

  nameEl.textContent = host;
  const verdict = decide(host, settings);
  const rule = findMatchingRule(host, settings.rules);
  const ruleLabel = rule ? (rule.strength === 'force' ? `!${rule.pattern}` : rule.pattern) : null;
  verdictEl.textContent = ruleLabel ? `${verdict} · ${ruleLabel}` : verdict;
  verdictEl.className = `verdict verdict-${verdict.toLowerCase()}`;
}

async function refreshHostInfo(): Promise<void> {
  const settings = await loadSettings();
  renderHostInfo(currentHost, settings);
}

/**
 * Только для Firefox: там browser.proxy.onRequest не видит запросы из
 * приватных окон, пока пользователь вручную не разрешит это в about:addons —
 * манифестом это не форсируется. Без разрешения приватное окно тихо идёт
 * в обход всей логики решения, поэтому явно предупреждаем в UI.
 * В Chrome/Opera прокси — PAC на уровне браузера, приватные окна и так
 * наследуют его без этого шага, поэтому там проверка не показывается.
 */
async function renderPrivateWarning(): Promise<void> {
  const el = document.getElementById('private-warning');
  if (!(el instanceof HTMLElement)) return;
  if (typeof browser === 'undefined') {
    el.hidden = true;
    return;
  }
  try {
    const allowed = await browser.extension.isAllowedIncognitoAccess();
    el.hidden = allowed;
  } catch {
    el.hidden = true;
  }
}

async function addCurrentDomain(): Promise<void> {
  if (!currentHost) return;
  const settings = await loadSettings();
  const already = settings.rules.some((rule) => rule.pattern.toLowerCase() === currentHost?.toLowerCase());
  if (!already) {
    const rules: Rule[] = [
      ...settings.rules,
      { pattern: currentHost, enabled: true, list: 'proxy', strength: 'soft' },
    ];
    const rulesUpdatedAt = Date.now();
    await saveSettings({ ...settings, rules, rulesUpdatedAt });

    // Как и «Сохранить» в options — если синхронизация включена, отправляем
    // изменение на сервер. Без статуса в UI: попап слишком мал и закрывается
    // сразу после клика, ошибку в худшем случае подтянет следующий pull.
    if (settings.sync.enabled && settings.sync.url && settings.sync.token) {
      void pushRules({ url: settings.sync.url, token: settings.sync.token }, { rules, updatedAt: rulesUpdatedAt }).catch(
        (err: unknown) => console.error('ocswitch: отправка на сервер не удалась', err),
      );
    }
  }
  await refreshHostInfo();
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  renderChecked(settings.mode);
  renderStatus(settings.mode);

  currentHost = await getActiveTabHost();
  renderHostInfo(currentHost, settings);
  void renderPrivateWarning();

  document.getElementById('modes')?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== 'mode') return;
    const mode = target.value as Mode;
    renderStatus(mode);
    void saveMode(mode).then(refreshHostInfo);
  });

  const addButton = document.getElementById('add-current');
  if (addButton instanceof HTMLButtonElement) {
    addButton.disabled = currentHost === null;
    addButton.addEventListener('click', () => void addCurrentDomain());
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    void refreshHostInfo();
  });
}

void init();
