import type { Rule } from './types.js';

/**
 * Клиент синхронизации через собственный сервер (см. server/sync-server.mjs).
 *
 * Только fetch() — никаких chrome или browser API, поэтому живёт в core
 * и одинаково работает из адаптеров обоих браузеров.
 */

export interface SyncPayload {
  rules: Rule[];
  updatedAt: number;
}

export interface SyncConfig {
  url: string;
  token: string;
}

function endpoint(url: string): string {
  return `${url.replace(/\/+$/, '')}/rules`;
}

export async function pullRules(config: SyncConfig): Promise<SyncPayload> {
  const res = await fetch(endpoint(config.url), {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!res.ok) throw new Error(`sync: сервер ответил ${res.status}`);
  return (await res.json()) as SyncPayload;
}

export async function pushRules(config: SyncConfig, payload: SyncPayload): Promise<void> {
  const res = await fetch(endpoint(config.url), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`sync: сервер ответил ${res.status}`);
}

/** true, если серверная версия свежее локальной — тогда её стоит применить («побеждает последний»). */
export function isRemoteNewer(local: SyncPayload, remote: SyncPayload): boolean {
  return remote.updatedAt > local.updatedAt;
}
