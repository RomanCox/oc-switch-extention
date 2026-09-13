import type { Settings } from './types.js';

/**
 * Собирает PAC-скрипт для chrome.proxy.
 *
 * PAC исполняется в песочнице браузера и не видит код расширения,
 * поэтому список правил и логика зашиваются в текст скрипта.
 *
 * Обязательно SOCKS5, а не SOCKS: второе — это SOCKS4, он резолвит
 * DNS на стороне клиента, и запросы имён утекают мимо туннеля.
 *
 * Расхождение этой реализации с decide() ловит тест-близнец.
 */
export function buildPacScript(_settings: Settings): string {
  throw new Error('not implemented: фаза 1');
}
