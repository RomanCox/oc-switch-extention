import { ALWAYS_DIRECT, type Settings } from './types.js';

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
  const rules = settings.rules.filter((rule) => rule.enabled).map((rule) => rule.pattern);
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
var RULES = ${JSON.stringify(rules)};
var PROXY = ${JSON.stringify(proxy)};

function FindProxyForURL(url, host) {
  if (matchAny(host, ALWAYS_DIRECT)) return "DIRECT";

  var matched = matchAny(host, RULES);

  if (MODE === "off") return "DIRECT";
  if (MODE === "all") return PROXY;
  if (MODE === "include") return matched ? PROXY : "DIRECT";
  if (MODE === "exclude") return matched ? "DIRECT" : PROXY;
  return "DIRECT";
}
`;
}
