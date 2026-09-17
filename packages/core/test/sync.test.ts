import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRemoteNewer, pullRules, pushRules } from '../src/sync.js';

describe('isRemoteNewer', () => {
  it('true, если updatedAt на сервере больше', () => {
    expect(isRemoteNewer({ rules: [], updatedAt: 1 }, { rules: [], updatedAt: 2 })).toBe(true);
  });

  it('false, если равны или локальная новее', () => {
    expect(isRemoteNewer({ rules: [], updatedAt: 5 }, { rules: [], updatedAt: 5 })).toBe(false);
    expect(isRemoteNewer({ rules: [], updatedAt: 5 }, { rules: [], updatedAt: 3 })).toBe(false);
  });
});

describe('pullRules/pushRules', () => {
  const config = { url: 'https://sync.example.com/', token: 'secret' };

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('шлёт Bearer-токен на {url}/rules', async () => {
    const payload = { rules: [], updatedAt: 42 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullRules(config);

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sync.example.com/rules',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret' } }),
    );
  });

  it('обрезает лишний слэш в url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ rules: [], updatedAt: 0 }) });
    vi.stubGlobal('fetch', fetchMock);

    await pullRules({ url: 'https://sync.example.com/', token: 't' });

    expect(fetchMock).toHaveBeenCalledWith('https://sync.example.com/rules', expect.anything());
  });

  it('бросает ошибку при не-200 на pull', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(pullRules(config)).rejects.toThrow('401');
  });

  it('pushRules отправляет PUT с JSON-телом', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const payload = { rules: [], updatedAt: 7 };

    await pushRules(config, payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sync.example.com/rules',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) }),
    );
  });

  it('бросает ошибку при не-200 на push', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(pushRules(config, { rules: [], updatedAt: 0 })).rejects.toThrow('500');
  });
});
