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
 * Строка в списке: необязательный `#` (отключено), необязательный `!`
 * (force — правило побеждает в любом режиме), затем хост-шаблон.
 * Своей логики матчинга нет — синтаксис хоста валидируется через core
 * (isValidPattern), чтобы не разъезжаться с decide()/PAC.
 */

declare const browser: typeof chrome | undefined;
const api: typeof chrome = typeof browser !== 'undefined' ? browser : chrome;

const STORAGE_KEY = 'settings';

const LISTS: RuleList[] = ['proxy', 'direct'];

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

function ruleToLine(rule: Rule): string {
  const body = (rule.strength === 'force' ? '!' : '') + rule.pattern;
  return rule.enabled ? body : `# ${body}`;
}

function rulesToText(rules: readonly Rule[], list: RuleList): string {
  return rules.filter((rule) => rule.list === list).map(ruleToLine).join('\n');
}

interface ParsedLine {
  lineNumber: number;
  rule?: Rule;
  error?: string;
}

/** Пустые строки и голый `#` — просто пропускаются, это не ошибка. */
function parseLine(raw: string, lineNumber: number, list: RuleList): ParsedLine {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '#') return { lineNumber };

  const disabled = trimmed.startsWith('#');
  const rest = disabled ? trimmed.slice(1).trim() : trimmed;
  if (rest === '') return { lineNumber };

  const force = rest.startsWith('!');
  const pattern = force ? rest.slice(1).trim() : rest;

  if (!isValidPattern(pattern)) {
    return { lineNumber, error: `строка ${lineNumber}: неверный хост «${pattern}»` };
  }
  return { lineNumber, rule: { pattern, enabled: !disabled, list, strength: force ? 'force' : 'soft' } };
}

function parseText(text: string, list: RuleList): ParsedLine[] {
  return text.split('\n').map((raw, i) => parseLine(raw, i + 1, list));
}

function renderErrors(list: RuleList, parsed: readonly ParsedLine[]): string[] {
  const el = document.getElementById(`errors-${list}`);
  const errors = parsed.filter((p): p is ParsedLine & { error: string } => p.error !== undefined).map((p) => p.error);
  if (el) {
    el.innerHTML = '';
    for (const error of errors) {
      const li = document.createElement('li');
      li.textContent = error;
      el.appendChild(li);
    }
  }
  return errors;
}

function setSaveStatus(text: string, kind: 'ok' | 'error' | '' = ''): void {
  const el = document.getElementById('save-status');
  if (!(el instanceof HTMLElement)) return;
  el.textContent = text;
  el.className = kind ? `save-status save-status-${kind}` : 'save-status';
}

function textarea(list: RuleList): HTMLTextAreaElement | null {
  const el = document.getElementById(`rules-${list}`);
  return el instanceof HTMLTextAreaElement ? el : null;
}

function validateAndRender(): { rules: Rule[]; valid: boolean } {
  let valid = true;
  const rules: Rule[] = [];
  for (const list of LISTS) {
    const el = textarea(list);
    const parsed = el ? parseText(el.value, list) : [];
    const errors = renderErrors(list, parsed);
    if (errors.length > 0) valid = false;
    for (const p of parsed) if (p.rule) rules.push(p.rule);
  }
  const saveButton = document.getElementById('save');
  if (saveButton instanceof HTMLButtonElement) saveButton.disabled = !valid;
  return { rules, valid };
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

async function init(): Promise<void> {
  const settings = await loadSettings();
  renderSyncFields(settings.sync);
  for (const list of LISTS) {
    const el = textarea(list);
    if (el) el.value = rulesToText(settings.rules, list);
    el?.addEventListener('input', () => {
      validateAndRender();
      setSaveStatus('');
    });
  }
  validateAndRender();

  document.getElementById('save')?.addEventListener('click', () => {
    void (async () => {
      const { rules, valid } = validateAndRender();
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
        for (const list of LISTS) {
          const el = textarea(list);
          if (el) el.value = rulesToText(remote.rules, list);
        }
        validateAndRender();

        const current = await loadSettings();
        await saveSettings({ ...current, rules: remote.rules, sync, rulesUpdatedAt: remote.updatedAt });
        setSyncStatus(`обновлено с сервера ✓ (${remote.rules.length} правил)`, 'ok');
      } catch (err) {
        setSyncStatus(`не удалось обновить: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    })();
  });

  document.getElementById('export')?.addEventListener('click', () => {
    const { rules } = validateAndRender();
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
          const rules = importRules(JSON.parse(String(reader.result)));
          for (const list of LISTS) {
            const el = textarea(list);
            if (el) el.value = rulesToText(rules, list);
          }
          validateAndRender();
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
