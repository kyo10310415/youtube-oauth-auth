# Render環境変数設定チェックリスト

## 必須環境変数（5つ）

### 1. DATABASE_URL
```
postgresql://<USER>:<PASSWORD>@<HOST>:5432/<DATABASE>
```

### 2. YOUTUBE_ANALYTICS_CLIENT_ID
```
Google Cloud Consoleから取得したクライアントID
形式例: 123456789-abcdefg.apps.googleusercontent.com
```

### 3. YOUTUBE_ANALYTICS_CLIENT_SECRET
```
Google Cloud Consoleから取得したクライアントシークレット
形式例: GOCSPX-aBcDeFgHiJkLmNoPqRs
```

### 4. YOUTUBE_ANALYTICS_REDIRECT_URI
```
https://youtube-oauth-auth.onrender.com/auth/callback
```

⚠️ **重要**: Google Cloud Consoleの「認証情報」→「OAuth 2.0 クライアントID」→「承認済みのリダイレクトURI」に、このURLを追加してください！

---

## Render設定手順

1. **Render Dashboard**: https://dashboard.render.com/
2. **youtube-oauth-auth** Webサービスを開く
3. **Environment** タブをクリック
4. **Add Environment Variable** で上記4つを追加
5. **Save Changes** をクリック（自動再デプロイ開始）

---

## デプロイ確認

Renderの **Logs** タブで以下を確認：

✅ `==> Your service is live 🎉`
✅ `🚀 YouTube OAuth認証サーバーが起動しました`
✅ `📍 ポート: 3000`

---

## 動作確認

### 1. ヘルスチェック
```bash
curl https://youtube-oauth-auth.onrender.com/health
```

期待値：
```json
{"status":"ok","timestamp":"2025-01-24T..."}
```

### 2. トップページアクセス
ブラウザで開く：
```
https://youtube-oauth-auth.onrender.com/
```

期待される表示：
- YouTubeアイコン 🎬
- "YouTube Analytics OAuth認証"のタイトル
- 学籍番号入力フィールド
- 「認証を開始」ボタン

---

## Google Cloud Console設定確認

### リダイレクトURI設定

1. https://console.cloud.google.com/
2. **APIとサービス** → **認証情報**
3. 既存の**OAuth 2.0 クライアントID**を開く
4. **承認済みのリダイレクトURI**に以下の**2つ**が登録されているか確認：

```
https://youtube-oauth-auth.onrender.com/auth/callback
https://vtuber-school-evaluation.onrender.com/api/analytics/auth/callback
```

⚠️ 両方とも必要です！削除しないでください。

---

## トラブルシューティング

### 502 Bad Gateway
- Renderの **Logs** でエラーを確認
- 環境変数が正しく設定されているか確認
- `npm start` コマンドが `node server.js` になっているか確認

### OAuth認証エラー
- Google Cloud ConsoleのリダイレクトURI設定を確認
- `YOUTUBE_ANALYTICS_REDIRECT_URI` が正しく設定されているか確認
- クライアントIDとシークレットが正しいか確認

### データベース接続エラー
- `DATABASE_URL` が正しく設定されているか確認
- PostgreSQLインスタンスが稼働しているか確認


## 認証情報の取扱い（2026-10-26）

過去にこの文書へ記載されていたDB認証情報は使用しないでください。Renderの対象DBで新しい認証情報を発行し、接続するサービスのDATABASE_URLへ保存します。文書のプレースホルダーをそのまま設定せず、値をチャット・Git・ログへ貼らないでください。新しい設定で配備・接続確認後に、旧認証情報を失効させる必要があります。文書からの削除だけでは失効しません。
