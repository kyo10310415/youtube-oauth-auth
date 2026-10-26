import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Hono } from 'hono';
import pg from 'pg';
import { getDatabaseConfig } from '../database-config.js';

test('server passes the TLS policy to its lazy pool without logging configuration', async () => {
  const source = (await readFile(new URL('../server.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '');
  for (const [host, expected] of [['database.example', true], ['dpg-fixture123-a', false]]) {
    const lines = []; let flow, parsed, allocations = 0;
    class Pool {
      constructor(config) { allocations++; parsed = new pg.Client(config).connectionParameters; }
    }
    const env = { RENDER: 'true', PORT: '3196', DATABASE_URL: `postgresql://fixture:fixture-only@${host}/fixture?sslmode=disable`,
      YOUTUBE_ANALYTICS_REDIRECT_URI: 'https://example.test/SYNTHETIC_PRIVATE_CONFIGURATION' };
    vm.runInNewContext(source, { Hono, pg: { Pool }, getDatabaseConfig: target => getDatabaseConfig(target, env),
      process: { env }, console: { log: (...args) => lines.push(args.join(' ')) },
      registerOAuthFlow: (app, dependencies) => { flow = dependencies; }, serve: (options, callback) => callback({ port: options.port }) });
    assert.equal(allocations, 0);
    assert.ok(flow.getDbPool());
    flow.getDbPool();
    assert.equal(allocations, 1);
    assert.equal(parsed.host, host);
    assert.equal(parsed.ssl.rejectUnauthorized, expected);
    assert.equal(lines.join('\n').includes('SYNTHETIC_PRIVATE_CONFIGURATION'), false);
    assert.equal(lines.join('\n').includes('fixture-only'), false);
  }
});
