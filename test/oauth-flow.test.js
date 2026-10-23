import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { registerOAuthFlow } from '../oauth-flow.js'

const origin = 'https://oauth.example.test'
const key = 'test-only-private-invitation-key-'.repeat(2)
function fixture({ exchangeOk = true, networkError = false } = {}) {
  const app = new Hono()
  let time = 1700000000000, exchanges = 0, writes = []
  const invitations = new Map()
  const db = { async query(sql, values) {
    if (sql.startsWith('INSERT INTO youtube_oauth_invitations')) {
      invitations.set(values[0], { student_id: values[1], expires: values[2].getTime() }); return { rows: [] }
    }
    if (sql.startsWith('DELETE FROM youtube_oauth_invitations')) {
      const item = invitations.get(values[0]); invitations.delete(values[0])
      return { rows: item && item.expires > time ? [item] : [] }
    }
    writes.push(values); return { rows: [] }
  } }
  registerOAuthFlow(app, { getDbPool: () => db, now: () => time,
    env: { YOUTUBE_INVITE_ADMIN_TOKEN: key, YOUTUBE_ANALYTICS_CLIENT_ID: 'test-client',
      YOUTUBE_ANALYTICS_CLIENT_SECRET: 'test-secret', YOUTUBE_ANALYTICS_REDIRECT_URI: origin + '/auth/callback' },
    fetchImpl: async () => { exchanges++; if (networkError) throw new Error('test network failure'); return { ok: exchangeOk, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) } } })
  async function request(path, body, headers = {}) {
    return app.request(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) })
  }
  async function invite(studentId = 'TEST-STUDENT') {
    const r = await request('/admin/invitations', { studentId }, { Authorization: `Bearer ${key}` })
    assert.equal(r.status, 201)
    return (await r.json()).invitation
  }
  async function start(invitation, extra = {}) {
    const r = await request('/auth/url', { invitation, ...extra })
    assert.equal(r.status, 200)
    const state = new URL((await r.json()).authUrl).searchParams.get('state')
    const cookie = r.headers.get('set-cookie').split(';')[0]
    assert.match(r.headers.get('set-cookie'), /HttpOnly/i)
    assert.match(r.headers.get('set-cookie'), /Secure/i)
    return { state, cookie }
  }
  const callback = ({ state, cookie }, suffix = '') => app.request(origin + '/auth/callback?code=test-code&state=' + encodeURIComponent(state) + suffix, { headers: { Cookie: cookie || '' } })
  return { app, request, invite, start, callback, tick: ms => { time += ms }, get exchanges() { return exchanges }, writes }
}

test('anonymous and short-key admin requests cannot issue invitations', async () => {
  const f = fixture()
  assert.equal((await f.request('/admin/invitations', { studentId: 'TEST' })).status, 401)
  assert.equal((await f.request('/admin/invitations', { studentId: '<invalid>' }, { Authorization: `Bearer ${key}` })).status, 400)
  assert.equal((await f.request('/admin/invitations', null, { Authorization: `Bearer ${key}` })).status, 400)
  const app = new Hono(); registerOAuthFlow(app, { env: {}, getDbPool: () => null })
  assert.equal((await app.request('/admin/invitations', { method: 'POST' })).status, 503)
})
test('legacy arbitrary student-ID start and fabricated invitation fail before exchange/write', async () => {
  const f = fixture()
  assert.equal((await f.app.request('/auth/url?studentId=OTHER')).status, 410)
  assert.equal((await f.request('/auth/url', { studentId: 'OTHER' })).status, 400)
  assert.equal((await f.request('/auth/url', null)).status, 400)
  assert.equal((await f.request('/auth/url', { invitation: 'a'.repeat(64) })).status, 400)
  assert.equal(f.exchanges, 0); assert.equal(f.writes.length, 0)
})
test('trusted invite fixes target regardless of supplied student ID; valid callback writes exactly that student', async () => {
  const f = fixture(), code = await f.invite('TRUSTED-STUDENT')
  const flow = await f.start(code, { studentId: 'ATTACKER-TARGET' })
  assert.equal((await f.callback(flow, '&studentId=ATTACKER-TARGET')).status, 200)
  assert.equal(f.exchanges, 1); assert.equal(f.writes.length, 1)
  assert.equal(f.writes[0][0], 'TRUSTED-STUDENT')
  assert.equal((await f.callback(flow)).status, 400)
  assert.equal((await f.request('/auth/url', { invitation: code })).status, 400)
  assert.equal(f.exchanges, 1); assert.equal(f.writes.length, 1)
})
test('tampered/legacy state, missing/cross-browser cookie reject without consuming legitimate state', async () => {
  const f = fixture(), flow = await f.start(await f.invite())
  for (const bad of [{ ...flow, state: 'OTHER:1700000000000' }, { ...flow, cookie: '' },
    { ...flow, cookie: 'youtube_oauth_browser=' + 'f'.repeat(64) }, { ...flow, state: 'e'.repeat(64) }]) {
    assert.equal((await f.callback(bad)).status, 400)
  }
  assert.equal(f.exchanges, 0); assert.equal(f.writes.length, 0)
  assert.equal((await f.callback(flow)).status, 200)
})
test('expired state/invitation and cross-origin starts reject', async () => {
  const f = fixture(), invite = await f.invite(), flow = await f.start(await f.invite())
  assert.equal((await f.request('/auth/url', { invitation: invite }, { Origin: 'https://other.example.test' })).status, 403)
  f.tick(600001)
  assert.equal((await f.callback(flow)).status, 400)
  f.tick(86400000)
  assert.equal((await f.request('/auth/url', { invitation: invite })).status, 400)
  assert.equal(f.exchanges, 0); assert.equal(f.writes.length, 0)
})
test('provider denial consumes valid state without exchanging or writing', async () => {
  const f = fixture(), flow = await f.start(await f.invite())
  assert.equal((await f.callback(flow, '&error=access_denied')).status, 400)
  assert.equal((await f.callback(flow)).status, 400)
  assert.equal(f.exchanges, 0); assert.equal(f.writes.length, 0)
})
test('failed token exchange never writes and cannot replay state', async () => {
  for (const options of [{ exchangeOk: false }, { networkError: true }]) {
    const f = fixture(options), flow = await f.start(await f.invite())
    assert.equal((await f.callback(flow)).status, 502)
    assert.equal((await f.callback(flow)).status, 400)
    assert.equal(f.exchanges, 1); assert.equal(f.writes.length, 0)
  }
})
