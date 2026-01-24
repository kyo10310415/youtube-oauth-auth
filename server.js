/**
 * YouTube OAuth認証専用サーバー
 * 生徒が自分でアクセスしてOAuth認証を行い、トークンをDBに保存
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pg from 'pg'
const { Pool } = pg

const app = new Hono()

// 環境変数
const PORT = process.env.PORT || 3000
const DATABASE_URL = process.env.DATABASE_URL
const YOUTUBE_ANALYTICS_CLIENT_ID = process.env.YOUTUBE_ANALYTICS_CLIENT_ID
const YOUTUBE_ANALYTICS_CLIENT_SECRET = process.env.YOUTUBE_ANALYTICS_CLIENT_SECRET
const YOUTUBE_ANALYTICS_REDIRECT_URI = process.env.YOUTUBE_ANALYTICS_REDIRECT_URI

// PostgreSQL接続プール
let pool = null

function getDbPool() {
  if (!pool && DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

// CORS設定
app.use('*', cors())

// トップページ（認証UI）
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>YouTube Analytics OAuth認証</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-lg w-full">
        <div class="bg-white rounded-2xl shadow-2xl p-8">
          <!-- ヘッダー -->
          <div class="text-center mb-8">
            <div class="inline-block p-4 bg-red-100 rounded-full mb-4">
              <i class="fab fa-youtube text-red-600 text-5xl"></i>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">YouTube Clipper</h1>
            <p class="text-lg text-gray-600">OAuth 2.0 認証</p>
          </div>

          <!-- 認証の流れ -->
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h2 class="flex items-center text-blue-900 font-semibold mb-3">
              <i class="fas fa-clipboard-list mr-2"></i>
              認証の流れ
            </h2>
            <ul class="space-y-2 text-sm text-blue-800">
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>Googleアカウントでログイン</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>YouTube アカウントの表示を許可</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>YouTube Analytics レポートの閲覧を許可</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>認証情報が自動的にBase64エンコードされます</span>
              </li>
            </ul>
          </div>

          <!-- 重要事項 -->
          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h2 class="flex items-center text-yellow-900 font-semibold mb-3">
              <i class="fas fa-exclamation-triangle mr-2"></i>
              重要事項
            </h2>
            <ul class="space-y-2 text-sm text-yellow-800">
              <li class="flex items-start">
                <span class="font-bold mr-2">•</span>
                <span><strong>チャンネル所有者（ユーザーA）</strong>のGoogleアカウントでログインしてください</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>「認証されていません」と表示された場合は「詳細」→「(unsafe)に移動」をクリック</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>すべての権限を許可してください</span>
              </li>
            </ul>
          </div>

          <!-- 学籍番号入力フォーム -->
          <div class="mb-6">
            <label for="student-id" class="block text-sm font-medium text-gray-700 mb-2">
              学籍番号
            </label>
            <input 
              type="text" 
              id="student-id" 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="例: OLST240115-WY"
              required
            >
            <p class="mt-2 text-sm text-gray-500">
              <i class="fas fa-info-circle mr-1"></i>
              あなたの学籍番号を入力してください
            </p>
          </div>

          <!-- 認証開始ボタン -->
          <button 
            id="auth-btn"
            class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-4 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition duration-200 shadow-lg flex items-center justify-center"
          >
            <i class="fas fa-key mr-2"></i>
            認証を開始
          </button>

          <!-- エラー表示 -->
          <div id="error-message" class="mt-4 hidden">
            <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p class="text-red-800 text-sm"></p>
            </div>
          </div>
        </div>

        <!-- フッター -->
        <div class="text-center mt-6">
          <p class="text-sm text-gray-600">
            <i class="fas fa-shield-alt mr-1"></i>
            安全なOAuth 2.0認証を使用しています
          </p>
        </div>
      </div>

      <script>
        const authBtn = document.getElementById('auth-btn');
        const studentIdInput = document.getElementById('student-id');
        const errorMessage = document.getElementById('error-message');

        authBtn.addEventListener('click', async () => {
          const studentId = studentIdInput.value.trim();
          
          if (!studentId) {
            showError('学籍番号を入力してください');
            return;
          }

          try {
            // 認証URL取得
            const response = await fetch(\`/auth/url?studentId=\${encodeURIComponent(studentId)}\`);
            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error);
            }

            // OAuth認証ページにリダイレクト
            window.location.href = data.authUrl;
          } catch (error) {
            showError(error.message);
          }
        });

        function showError(message) {
          errorMessage.classList.remove('hidden');
          errorMessage.querySelector('p').textContent = message;
        }

        // Enterキーで認証開始
        studentIdInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            authBtn.click();
          }
        });
      </script>
    </body>
    </html>
  `)
})

// OAuth認証URL生成
app.get('/auth/url', (c) => {
  const studentId = c.req.query('studentId')
  
  if (!studentId) {
    return c.json({ success: false, error: '学籍番号が必要です' }, 400)
  }

  if (!YOUTUBE_ANALYTICS_CLIENT_ID || !YOUTUBE_ANALYTICS_REDIRECT_URI) {
    return c.json({ 
      success: false, 
      error: 'OAuth設定が不足しています' 
    }, 500)
  }

  // state: 学籍番号とタイムスタンプ
  const state = `${studentId}:${Date.now()}`

  // OAuth URL
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ]

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', YOUTUBE_ANALYTICS_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', YOUTUBE_ANALYTICS_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  return c.json({
    success: true,
    authUrl: authUrl.toString(),
  })
})

// OAuth コールバック
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  // エラー処理
  if (error) {
    return c.html(\`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証エラー</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen p-4">
        <div class="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div class="text-center mb-4">
            <i class="fas fa-times-circle text-red-500 text-6xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 mb-4 text-center">認証エラー</h1>
          <p class="text-gray-600 text-center mb-6">認証がキャンセルされました</p>
          <a href="/" class="block w-full bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition text-center">
            トップページに戻る
          </a>
        </div>
      </body>
      </html>
    \`)
  }

  if (!code || !state) {
    return c.json({ success: false, error: '無効なコールバック' }, 400)
  }

  try {
    // stateから学籍番号を抽出
    const [studentId] = state.split(':')

    // トークン交換
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: YOUTUBE_ANALYTICS_CLIENT_ID!,
        client_secret: YOUTUBE_ANALYTICS_CLIENT_SECRET!,
        redirect_uri: YOUTUBE_ANALYTICS_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      throw new Error('トークン取得に失敗しました')
    }

    // PostgreSQLに保存
    const pool = getDbPool()
    if (pool) {
      const expiresAt = Date.now() + (tokenData.expires_in * 1000)
      
      await pool.query(\`
        INSERT INTO youtube_oauth_tokens (student_id, access_token, refresh_token, expires_at, token_type, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          token_type = EXCLUDED.token_type,
          updated_at = CURRENT_TIMESTAMP
      \`, [
        studentId,
        tokenData.access_token,
        tokenData.refresh_token || null,
        expiresAt,
        tokenData.token_type || 'Bearer',
      ])
    }

    // 成功ページ
    return c.html(\`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証完了</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
      </head>
      <body class="bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 min-h-screen flex items-center justify-center p-4">
        <div class="max-w-md w-full">
          <div class="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div class="inline-block p-4 bg-green-100 rounded-full mb-6">
              <i class="fas fa-check-circle text-green-600 text-6xl"></i>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 mb-4">認証完了！</h1>
            <p class="text-lg text-gray-600 mb-2">学籍番号: <span class="font-mono font-bold text-purple-600">\${studentId}</span></p>
            <p class="text-gray-500 mb-8">
              YouTube Analyticsデータへのアクセスが許可されました。<br>
              トークンはデータベースに安全に保存されました。
            </p>
            
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 text-left mb-6">
              <h2 class="font-semibold text-blue-900 mb-2">
                <i class="fas fa-info-circle mr-2"></i>
                次のステップ
              </h2>
              <p class="text-sm text-blue-800">
                このページを閉じて、メインアプリの所属生データページでデータを確認してください。
              </p>
            </div>

            <a href="/" class="block w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-lg">
              トップページに戻る
            </a>
          </div>
        </div>
      </body>
      </html>
    \`)
  } catch (error) {
    console.error('[OAuth Callback] Error:', error)
    return c.html(\`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>エラー</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen p-4">
        <div class="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h1 class="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
          <p class="text-gray-600 mb-6">\${error.message}</p>
          <a href="/" class="block w-full bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition text-center">
            トップページに戻る
          </a>
        </div>
      </body>
      </html>
    \`)
  }
})

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// サーバー起動
console.log(`🚀 YouTube OAuth Auth Server starting on port ${PORT}...`)

serve({
  fetch: app.fetch,
  port: Number(PORT),
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`)
  console.log(`📊 Environment:`)
  console.log(`   - DATABASE_URL: ${DATABASE_URL ? '✓ Set' : '✗ Not set'}`)
  console.log(`   - CLIENT_ID: ${YOUTUBE_ANALYTICS_CLIENT_ID ? '✓ Set' : '✗ Not set'}`)
  console.log(`   - CLIENT_SECRET: ${YOUTUBE_ANALYTICS_CLIENT_SECRET ? '✓ Set' : '✗ Not set'}`)
  console.log(`   - REDIRECT_URI: ${YOUTUBE_ANALYTICS_REDIRECT_URI || 'Not set'}`)
})
