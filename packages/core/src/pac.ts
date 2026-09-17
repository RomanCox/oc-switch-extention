import { ALWAYS_DIRECT, type Rule, type Settings } from './types.js';

function patterns(rules: readonly Rule[], list: Rule['list'], strength?: Rule['strength']): string[] {
  return rules
    .filter((rule) => rule.enabled && rule.list === list && (strength === undefined || rule.strength === strength))
    .map((rule) => rule.pattern);
}

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
export function buildPacScript(settings: Settings): string {
  const forceProxy = patterns(settings.rules, 'proxy', 'force');
  const forceDirect = patterns(settings.rules, 'direct', 'force');
  const proxyList = patterns(settings.rules, 'proxy');
  const directList = patterns(settings.rules, 'direct');
  const proxy = `SOCKS5 ${settings.proxy.host}:${settings.proxy.port}`;

  return `
function matchHost(host, pattern) {
  var h = host.toLowerCase();
  var p = pattern.toLowerCase();
  if (p.charAt(0) === '*' && p.charAt(1) === '.') {
    var suffix = p.slice(1);
    return h.length > suffix.length && h.slice(h.length - suffix.length) === suffix;
  }
  return h === p || h.slice(-(p.length + 1)) === '.' + p;
}

function matchAny(host, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    if (matchHost(host, patterns[i])) return true;
  }
  return false;
}

var ALWAYS_DIRECT = ${JSON.stringify(ALWAYS_DIRECT)};
var MODE = ${JSON.stringify(settings.mode)};
var FORCE_PROXY = ${JSON.stringify(forceProxy)};
var FORCE_DIRECT = ${JSON.stringify(forceDirect)};
var PROXY_LIST = ${JSON.stringify(proxyList)};
var DIRECT_LIST = ${JSON.stringify(directList)};
var PROXY = ${JSON.stringify(proxy)};

function FindProxyForURL(url, host) {
  if (matchAny(host, ALWAYS_DIRECT)) return "DIRECT";

  if (matchAny(host, FORCE_PROXY)) return PROXY;
  if (matchAny(host, FORCE_DIRECT)) return "DIRECT";

  if (MODE === "off") return "DIRECT";
  if (MODE === "all") return PROXY;
  if (MODE === "include") return matchAny(host, PROXY_LIST) ? PROXY : "DIRECT";
  if (MODE === "exclude") return matchAny(host, DIRECT_LIST) ? "DIRECT" : PROXY;
  return "DIRECT";
}
`;
}
