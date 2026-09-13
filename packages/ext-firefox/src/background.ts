import { decide, DEFAULT_SETTINGS, type Settings } from '../../core/src/index.js';

/**
 * Firefox-адаптер. PAC не нужен: onRequest вызывает decide() напрямую,
 * поэтому обе реализации здесь заведомо совпадают.
 */

declare const browser: {
  proxy: {
    onRequest: {
      addListener(
        fn: (req: { url: string }) => unknown,
        filter: { urls: string[] },
      ): void;
    };
  };
};

let current: Settings = DEFAULT_SETTINGS;

export function setSettings(next: Settings): void {
  current = next;
}

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

// TODO фаза 4: загрузка настроек из storage.local, реакция на изменения.
