#!/usr/bin/env node
// Минимальный сервер синхронизации списков правил ocswitch между браузерами.
//
// Хранит один JSON-файл { rules, updatedAt } и отдаёт/принимает его
// по Bearer-токену. Без базы данных, без зависимостей — только Node.
//
// Запуск:
//   OCSWITCH_SYNC_TOKEN=секрет node server/sync-server.mjs
//
// Переменные окружения:
//   OCSWITCH_SYNC_TOKEN  — обязателен, тот же токен указывается в options
//   OCSWITCH_SYNC_PORT   — порт, по умолчанию 8790
//   OCSWITCH_SYNC_FILE   — путь к файлу с данными, по умолчанию server/rules.json

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.OCSWITCH_SYNC_PORT || 8790);
const TOKEN = process.env.OCSWITCH_SYNC_TOKEN;
const FILE = process.env.OCSWITCH_SYNC_FILE || fileURLToPath(new URL('./rules.json', import.meta.url));

if (!TOKEN) {
  console.error('OCSWITCH_SYNC_TOKEN не задан — иначе правила отдавались бы кому угодно. Останов.');
  process.exit(1);
}

async function readPayload() {
  if (!existsSync(FILE)) return { rules: [], updatedAt: 0 };
  return JSON.parse(await readFile(FILE, 'utf8'));
}

async function writePayload(payload) {
  // Пишем во временный файл и переименовываем — так обрыв записи
  // не оставит на диске битый JSON.
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 2));
  await rename(tmp, FILE);
}

function isValidRule(r) {
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.pattern === 'string' &&
    typeof r.enabled === 'boolean' &&
    (r.list === 'proxy' || r.list === 'direct') &&
    (r.strength === 'force' || r.strength === 'soft')
  );
}

function isValidPayload(data) {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.updatedAt === 'number' &&
    Array.isArray(data.rules) &&
    data.rules.every(isValidRule)
  );
}

function authorized(req) {
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.url !== '/rules') return send(res, 404, { error: 'not found' });
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });

  if (req.method === 'GET') {
    return send(res, 200, await readPayload());
  }

  if (req.method === 'PUT') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let data;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return send(res, 400, { error: 'invalid json' });
    }
    if (!isValidPayload(data)) return send(res, 400, { error: 'invalid payload shape' });
    await writePayload(data);
    return send(res, 200, data);
  }

  return send(res, 405, { error: 'method not allowed' });
}).listen(PORT, () => {
  console.log(`ocswitch sync server: http://0.0.0.0:${PORT}, файл: ${FILE}`);
});
