import {
  DEFAULT_SETTINGS,
  isValidPattern,
  pullRules,
  pushRules,
  type Rule,
  type RuleList,
  type Settings,
  type SyncSettings,
} from '../core/src/index.js';

/**
 * Страница опций: два списка правил — «+VPN» (proxy) и «−VPN» (direct).
 *
 * Каждое правило — отдельная строка-редактор (хост, вкл/выкл, force),
 * без текстового синтаксиса. Синтаксис хоста валидируется через core
 * (isValidPattern), чтобы не разъезжаться с decide()/PAC.
 */

declare const browser: typeof chrome | undefined;
const api: typeof chrome = typeof browser !== 'undefined' ? browser : chrome;

const STORAGE_KEY = 'settings';

const LISTS: RuleList[] = ['proxy', 'direct'];

interface Row {
  id: number;
  rule: Rule;
}

let rows: Row[] = [];
let nextId = 1;

function toRows(rules: readonly Rule[]): Row[] {
  return rules.map((rule) => ({ id: nextId++, rule: { ...rule } }));
}

function currentRules(): Rule[] {
  return rows.map((row) => ({ ...row.rule, pattern: row.rule.pattern.trim() }));
}

async function loadSettings(): Promise<Settings> {
  const raw = await api.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw[STORAGE_KEY] as Partial<Settings> | undefined) };
}

async function saveSettings(settings: Settings): Promise<void> {
  await api.storage.local.set({ [STORAGE_KEY]: settings });
}

/** Читает поля синхронизации прямо из инпутов — не требует предварительного «Сохранить». */
function readSyncFields(): SyncSettings {
  const url = document.getElementById('sync-url');
  const token = document.getElementById('sync-token');
  const enabled = document.getElementById('sync-enabled');
  return {
    url: url instanceof HTMLInputElement ? url.value.trim() : '',
    token: token instanceof HTMLInputElement ? token.value.trim() : '',
    enabled: enabled instanceof HTMLInputElement ? enabled.checked : false,
  };
}

function renderSyncFields(sync: SyncSettings): void {
  const url = document.getElementById('sync-url');
  const token = document.getElementById('sync-token');
  const enabled = document.getElementById('sync-enabled');
  if (url instanceof HTMLInputElement) url.value = sync.url;
  if (token instanceof HTMLInputElement) token.value = sync.token;
  if (enabled instanceof HTMLInputElement) enabled.checked = sync.enabled;
}

function setSyncStatus(text: string, kind: 'ok' | 'error' | '' = ''): void {
  const el = document.getElementById('sync-status');
  if (!(el instanceof HTMLElement)) return;
  el.textContent = text;
  el.className = kind ? `save-status save-status-${kind}` : 'save-status';
}

function setSaveStatus(text: string, kind: 'ok' | 'error' | '' = ''): void {
  const el = document.getElementById('save-status');
  if (!(el instanceof HTMLElement)) return;
  el.textContent = text;
  el.className = kind ? `save-status save-status-${kind}` : 'save-status';
}

function rowsContainer(list: RuleList): HTMLElement | null {
  const el = document.getElementById(`rows-${list}`);
  return el instanceof HTMLElement ? el : null;
}

/** Пересобирает DOM списка `list` из текущего состояния `rows`. */
function renderList(list: RuleList): void {
  const container = rowsContainer(list);
  if (!container) return;
  container.innerHTML = '';

  for (const row of rows) {
    if (row.rule.list !== list) continue;
    container.appendChild(buildRow(row));
  }
}

function buildRow(row: Row): HTMLElement {
  const el = document.createElement('div');
  el.className = 'rule-row';
  el.dataset.id = String(row.id);

  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.className = 'rule-enabled';
  enabled.title = 'включено';
  enabled.checked = row.rule.enabled;
  enabled.addEventListener('change', () => {
    row.rule.enabled = enabled.checked;
    setSaveStatus('');
  });

  const pattern = document.createElement('input');
  pattern.type = 'text';
  pattern.className = 'rule-pattern';
  pattern.spellcheck = false;
  pattern.autocomplete = 'off';
  pattern.placeholder = 'example.com или *.example.com';
  pattern.value = row.rule.pattern;
  pattern.addEventListener('input', () => {
    row.rule.pattern = pattern.value;
    validate();
    setSaveStatus('');
  });

  const forceLabel = document.createElement('label');
  forceLabel.className = 'rule-force-label';
  const force = document.createElement('input');
  force.type = 'checkbox';
  force.className = 'rule-force';
  force.checked = row.rule.strength === 'force';
  force.addEventListener('change', () => {
    row.rule.strength = force.checked ? 'force' : 'soft';
    setSaveStatus('');
  });
  forceLabel.appendChild(force);
  forceLabel.append('always');

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'rule-delete';
  remove.setAttribute('aria-label', 'удалить');
  remove.textContent = '✕';
  remove.addEventListener('click', () => {
    rows = rows.filter((r) => r.id !== row.id);
    renderList(row.rule.list);
    validate();
    setSaveStatus('');
  });

  el.append(enabled, pattern, forceLabel, remove);
  return el;
}

/** Валидирует текущее состояние `rows`, красит невалидные поля и обновляет список ошибок. */
function validate(): { rules: Rule[]; valid: boolean } {
  let valid = true;

  for (const list of LISTS) {
    const container = rowsContainer(list);
    const errors: string[] = [];
    const rowsForList = rows.filter((r) => r.rule.list === list);

    rowsForList.forEach((row, index) => {
      const input = container?.querySelector<HTMLInputElement>(`.rule-row[data-id="${row.id}"] .rule-pattern`);
      const pattern = row.rule.pattern.trim();
      const error = pattern === '' ? 'пустой хост — заполните или удалите строку' : !isValidPattern(pattern) ? `неверный хост «${pattern}»` : null;
      if (input) input.classList.toggle('invalid', error !== null);
      if (error) {
        errors.push(`строка ${index + 1}: ${error}`);
        valid = false;
      }
    });

    const errorsEl = document.getElementById(`errors-${list}`);
    if (errorsEl) {
      errorsEl.innerHTML = '';
      for (const error of errors) {
        const li = document.createElement('li');
        li.textContent = error;
        errorsEl.appendChild(li);
      }
    }
  }

  const saveButton = document.getElementById('save');
  if (saveButton instanceof HTMLButtonElement) saveButton.disabled = !valid;
  return { rules: currentRules(), valid };
}

function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isRuleList(value: unknown): value is RuleList {
  return value === 'proxy' || value === 'direct';
}

function importRules(data: unknown): Rule[] {
  if (!Array.isArray(data)) throw new Error('ожидался массив правил');
  return data.map((item) => {
    if (typeof item !== 'object' || item === null || typeof (item as Rule).pattern !== 'string') {
      throw new Error('каждое правило должно быть { pattern, enabled, list, strength }');
    }
    const r = item as Partial<Rule>;
    if (!isRuleList(r.list)) {
      throw new Error(`у правила «${r.pattern}» отсутствует или неверен список list: "proxy"|"direct"`);
    }
    return {
      pattern: r.pattern as string,
      enabled: r.enabled !== false,
      list: r.list,
      strength: r.strength === 'force' ? 'force' : 'soft',
    };
  });
}

function renderAll(): void {
  for (const list of LISTS) renderList(list);
  validate();
}

async function init(): Promise<void> {
  const settings = await loadSettings();
  renderSyncFields(settings.sync);
  rows = toRows(settings.rules);
  renderAll();

  for (const list of LISTS) {
    document.getElementById(`add-${list}`)?.addEventListener('click', () => {
      const row: Row = { id: nextId++, rule: { pattern: '', enabled: true, list, strength: 'soft' } };
      rows.push(row);
      renderList(list);
      validate();
      setSaveStatus('');
      rowsContainer(list)?.querySelector<HTMLInputElement>(`.rule-row[data-id="${row.id}"] .rule-pattern`)?.focus();
    });
  }

  document.getElementById('save')?.addEventListener('click', () => {
    void (async () => {
      const { rules, valid } = validate();
      if (!valid) return;

      const current = await loadSettings();
      const sync = readSyncFields();
      const next: Settings = { ...current, rules, sync, rulesUpdatedAt: Date.now() };
      await saveSettings(next);

      if (!sync.enabled) {
        setSaveStatus('сохранено ✓', 'ok');
        return;
      }
      if (!sync.url || !sync.token) {
        setSaveStatus('сохранено локально, но не задан адрес/токен сервера', 'error');
        return;
      }
      try {
        await pushRules({ url: sync.url, token: sync.token }, { rules, updatedAt: next.rulesUpdatedAt });
        setSaveStatus('сохранено ✓ и отправлено на сервер ✓', 'ok');
      } catch (err) {
        setSaveStatus(`сохранено локально, но отправка на сервер не удалась: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    })();
  });

  document.getElementById('sync-pull')?.addEventListener('click', () => {
    void (async () => {
      const sync = readSyncFields();
      if (!sync.url || !sync.token) {
        setSyncStatus('укажите адрес сервера и токен', 'error');
        return;
      }
      setSyncStatus('обновляю…');
      try {
        const remote = await pullRules({ url: sync.url, token: sync.token });
        rows = toRows(remote.rules);
        renderAll();

        const current = await loadSettings();
        await saveSettings({ ...current, rules: remote.rules, sync, rulesUpdatedAt: remote.updatedAt });
        setSyncStatus(`обновлено с сервера ✓ (${remote.rules.length} правил)`, 'ok');
      } catch (err) {
        setSyncStatus(`не удалось обновить: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    })();
  });

  document.getElementById('export')?.addEventListener('click', () => {
    const { rules } = validate();
    triggerDownload('ocswitch-rules.json', JSON.stringify(rules, null, 2));
  });

  const fileInput = document.getElementById('import-file');
  document.getElementById('import')?.addEventListener('click', () => {
    if (fileInput instanceof HTMLInputElement) fileInput.click();
  });

  if (fileInput instanceof HTMLInputElement) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          rows = toRows(importRules(JSON.parse(String(reader.result))));
          renderAll();
          setSaveStatus('импортировано, проверьте и сохраните', 'ok');
        } catch (err) {
          setSaveStatus(`ошибка импорта: ${err instanceof Error ? err.message : String(err)}`, 'error');
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }
}

void init();
