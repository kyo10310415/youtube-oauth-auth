import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { bodyLimit } from 'hono/body-limit'

const cookieName = 'youtube_oauth_browser'
const hash = value => createHash('sha256').update(value).digest('hex')
const opaque = () => randomBytes(32).toString('hex')
const isOpaque = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const validStudent = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)
const denied = c => c.json({ success: false, error: '認証リンクが無効か期限切れです。管理者へ再発行を依頼してください。' }, 400)

export function registerOAuthFlow(app, { getDbPool, env = process.env, fetchImpl = fetch, now = Date.now }) {
  const pending = new Map()
  const settings = () => {
    const redirect = new URL(env.YOUTUBE_ANALYTICS_REDIRECT_URI)
    if (redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.search || redirect.hash ||
        !env.YOUTUBE_ANALYTICS_CLIENT_ID || !env.YOUTUBE_ANALYTICS_CLIENT_SECRET || !getDbPool()) throw new Error('OAuth unavailable')
    return redirect
  }
  app.use('/auth/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    c.header('Referrer-Policy', 'no-referrer')
    await next()
  })
  app.use('/admin/*', bodyLimit({ maxSize: 4096 }))
  app.use('/auth/url', bodyLimit({ maxSize: 4096 }))

  // Only trusted administrators can bind an invitation to a student.
  app.post('/admin/invitations', async c => {
    const key = env.YOUTUBE_INVITE_ADMIN_TOKEN
    if (typeof key !== 'string' || key.trim().length < 32) return c.json({ error: 'Invitation service unavailable' }, 503)
    const expected = Buffer.from(`Bearer ${key}`)
    const supplied = Buffer.from(c.req.header('Authorization') || '')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return c.json({ error: 'Unauthorized' }, 401)
    let body
    try { body = await c.req.json() } catch { return c.json({ error: 'Invalid request' }, 400) }
    if (!body || !validStudent(body.studentId)) return c.json({ error: 'Invalid student ID' }, 400)
    try {
      settings()
      const invite = opaque()
      await getDbPool().query('INSERT INTO youtube_oauth_invitations (token_hash, student_id, expires_at) VALUES ($1, $2, $3)',
        [hash(invite), body.studentId, new Date(now() + 24 * 60 * 60 * 1000)])
      c.header('Cache-Control', 'no-store')
      return c.json({ success: true, invitation: invite, expiresIn: 86400 }, 201)
    } catch { return c.json({ error: 'Invitation service unavailable' }, 503) }
  })

  app.get('/auth/url', c => c.json({ success: false, error: '管理者から受け取った認証コードを使用してください。' }, 410))
  app.post('/auth/url', async c => {
    let body
    try { body = await c.req.json() } catch { return denied(c) }
    if (!body || !isOpaque(body.invitation)) return denied(c)
    try {
      const redirect = settings()
      if (c.req.header('Origin') !== redirect.origin) return c.json({ error: 'Forbidden origin' }, 403)
      for (const [key, item] of pending) if (item.expires <= now()) pending.delete(key)
      if (pending.size >= 1000) return c.json({ error: 'Retry later' }, 429)
      // Atomic DELETE makes the invitation single-use across processes and restarts.
      const result = await getDbPool().query('DELETE FROM youtube_oauth_invitations WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP RETURNING student_id', [hash(body.invitation)])
      if (result.rows.length !== 1 || !validStudent(result.rows[0].student_id)) return denied(c)
      const state = opaque()
      const browser = opaque()
      pending.set(state, { studentId: result.rows[0].student_id, browser, expires: now() + 10 * 60 * 1000 })
      setCookie(c, cookieName, browser, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/auth', maxAge: 600 })
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      for (const [key, value] of Object.entries({ client_id: env.YOUTUBE_ANALYTICS_CLIENT_ID,
        redirect_uri: redirect.href, response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
        access_type: 'offline', prompt: 'consent', state })) authUrl.searchParams.set(key, value)
      return c.json({ success: true, authUrl: authUrl.href })
    } catch { return c.json({ success: false, error: '認証を開始できません。管理者へお問い合わせください。' }, 503) }
  })

  app.get('/auth/callback', async c => {
    const state = c.req.query('state')
    const browser = getCookie(c, cookieName)
    if (!isOpaque(state) || !isOpaque(browser)) return denied(c)
    const item = pending.get(state)
    if (!item || item.expires <= now()) { pending.delete(state); return denied(c) }
    if (!timingSafeEqual(Buffer.from(browser), Buffer.from(item.browser))) return denied(c)
    pending.delete(state) // Consume before any token exchange, including failed exchanges.
    deleteCookie(c, cookieName, { path: '/auth', secure: true, sameSite: 'Lax' })
    const code = c.req.query('code')
    if (c.req.query('error') || typeof code !== 'string' || !code || code.length > 4096) return denied(c)
    try {
      const redirect = settings()
      const response = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.YOUTUBE_ANALYTICS_CLIENT_ID, client_secret: env.YOUTUBE_ANALYTICS_CLIENT_SECRET,
          redirect_uri: redirect.href, grant_type: 'authorization_code' }) })
      const token = await response.json()
      if (!response.ok || typeof token.access_token !== 'string' || !token.access_token ||
          !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0) throw new Error('Token exchange failed')
      await getDbPool().query(`INSERT INTO youtube_oauth_tokens (student_id, access_token, refresh_token, expires_at, token_type, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id) DO UPDATE SET access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, youtube_oauth_tokens.refresh_token),
          expires_at = EXCLUDED.expires_at, token_type = EXCLUDED.token_type, updated_at = CURRENT_TIMESTAMP`,
        [item.studentId, token.access_token, token.refresh_token || null, now() + Number(token.expires_in) * 1000, token.token_type || 'Bearer'])
      return c.html('<!doctype html><html lang="ja"><meta charset="utf-8"><title>認証完了</title><h1>認証完了</h1><p>YouTubeアカウントを登録しました。このページを閉じてください。</p></html>')
    } catch { return c.json({ success: false, error: '認証を完了できません。管理者へ再発行を依頼してください。' }, 502) }
  })
}
