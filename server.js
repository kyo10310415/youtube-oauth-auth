import { getDatabaseConfig } from './database-config.js'
/**
 * YouTube OAuth認証専用サーバー
 * 生徒が自分でアクセスしてOAuth認証を行い、トークンをDBに保存
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { registerOAuthFlow } from './oauth-flow.js'
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
    pool = new Pool(getDatabaseConfig(DATABASE_URL))
  }
  return pool
}

// CORS設定


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
                <span>認証情報をサーバーへ保存します</span>
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
                <span>不明な認証警告が表示された場合は管理者へお問い合わせください</span>
              </li>
              <li class="flex items-start">
                <span class="mr-2">•</span>
                <span>すべての権限を許可してください</span>
              </li>
            </ul>
          </div>

          <!-- 招待コード入力フォーム -->
          <div class="mb-6">
            <label for="student-id" class="block text-sm font-medium text-gray-700 mb-2">
              招待コード
            </label>
            <input 
              type="text" 
              id="student-id" 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="管理者から受け取った認証コード"
              required
            >
            <p class="mt-2 text-sm text-gray-500">
              <i class="fas fa-info-circle mr-1"></i>
              管理者から受け取った一回限りの認証コードを入力してください
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
            showError('招待コードを入力してください');
            return;
          }

          try {
            // 認証URL取得
            const response = await fetch('/auth/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitation: studentId }) });
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

registerOAuthFlow(app, { getDbPool })

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

})
