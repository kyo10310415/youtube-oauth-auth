# YouTube Analytics OAuth認証アプリ

生徒が自分でアクセスしてYouTube Analytics APIのOAuth認証を行い、トークンを自動的にデータベースに保存するWebアプリです。

## 機能

- シンプルなUI（学籍番号入力 → 認証 → 完了）
- Google OAuth 2.0 認証
- トークンを自動的にPostgreSQLに保存
- リフレッシュトークン対応

## デプロイ方法

### 1. GitHubリポジトリ作成

```bash
cd /home/user/youtube-oauth-auth
git init
git add .
git commit -m "Initial commit: YouTube OAuth Auth App"
gh repo create youtube-oauth-auth --public --source=. --remote=origin --push
```

### 2. Renderで新しいWebサービスを作成

1. Render Dashboard → **New** → **Web Service**
2. GitHubリポジトリを選択: `youtube-oauth-auth`
3. 設定:
   - **Name**: `youtube-oauth-auth`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 3. 環境変数を設定

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `<メインアプリと同じPostgreSQL接続URL>` |
| `YOUTUBE_ANALYTICS_CLIENT_ID` | `<Google Cloud ConsoleのクライアントID>` |
| `YOUTUBE_ANALYTICS_CLIENT_SECRET` | `<Google Cloud Consoleのクライアントシークレット>` |
| `YOUTUBE_ANALYTICS_REDIRECT_URI` | `https://youtube-oauth-auth.onrender.com/auth/callback` |

### 4. Google Cloud Consoleの設定更新

**APIとサービス** → **認証情報** → OAuth 2.0 クライアントID

**承認済みのリダイレクトURI**に追加:
```
https://youtube-oauth-auth.onrender.com/auth/callback
```

## 使い方

### 生徒向け

1. https://youtube-oauth-auth.onrender.com/ にアクセス
2. 学籍番号を入力（例: OLST240115-WY）
3. 「認証を開始」ボタンをクリック
4. YouTubeアカウントでログイン
5. アクセス許可を承認
6. 認証完了！

### 管理者向け

生徒に以下のURLを送付：
```
https://youtube-oauth-auth.onrender.com/
```

## 技術スタック

- **Node.js** + **Hono** (軽量Webフレームワーク)
- **PostgreSQL** (トークン保存)
- **Google OAuth 2.0** (YouTube Analytics API認証)
- **TailwindCSS** (UI)

## セキュリティ

- トークンはPostgreSQLに暗号化して保存
- OAuth 2.0標準プロトコルを使用
- リフレッシュトークンで自動更新

## ライセンス

MIT
