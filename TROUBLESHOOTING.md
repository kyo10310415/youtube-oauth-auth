# 現在の状況まとめ

## ✅ 完了した作業

1. **GitHubリポジトリ作成**: `youtube-oauth-auth`
2. **コードのプッシュ**: 最新のコミット `c87d21e`
3. **PostgreSQLテーブル作成**: `youtube_oauth_tokens`
4. **マイグレーション実行完了**: テーブルが正常に作成された

---

## ⚠️ 現在の問題

**Renderデプロイで502 Bad Gateway**
- サービスURL: https://youtube-oauth-auth.onrender.com/
- 問題: サービスが起動していない

---

## 🔍 次に確認すべきこと

### 1. Renderの環境変数設定を確認

以下の**4つの環境変数**が正しく設定されているか確認してください：

```
DATABASE_URL=postgresql://vtuber_school_evaluation_user:kWEZaVgrOyWvrZbCPWrSgP46SrIshaNI@dpg-d5ppgkq4d50c73acrj10-a.oregon-postgres.render.com:5432/vtuber_school_evaluation

YOUTUBE_ANALYTICS_CLIENT_ID=<Google Cloud Consoleから取得>

YOUTUBE_ANALYTICS_CLIENT_SECRET=<Google Cloud Consoleから取得>

YOUTUBE_ANALYTICS_REDIRECT_URI=https://youtube-oauth-auth.onrender.com/auth/callback
```

### 2. Renderのログを確認

Render Dashboard → youtube-oauth-auth → **Logs** タブを開いて、以下のエラーがないか確認：

#### 期待するログ（正常時）：
```
==> Your service is live 🎉
🚀 YouTube OAuth認証サーバーが起動しました
📍 ポート: 3000
```

#### よくあるエラーパターン：

**パターンA: 環境変数不足**
```
Error: Missing required environment variable: DATABASE_URL
Error: Missing required environment variable: YOUTUBE_ANALYTICS_CLIENT_ID
```
→ Environmentタブで環境変数を追加してください

**パターンB: npm startコマンドエラー**
```
sh: node: not found
Error: Cannot find module 'hono'
```
→ Build Commandが `npm install` になっているか確認

**パターンC: ポート番号エラー**
```
Error: EADDRINUSE: address already in use :::3000
```
→ Render側の問題なので、サービスを再起動してください

**パターンD: データベース接続エラー**
```
Error: getaddrinfo ENOTFOUND dpg-xxxxx
```
→ DATABASE_URLが正しいか確認してください

---

## 📋 Renderでの設定手順（再確認）

### Webサービス設定

1. **Render Dashboard**: https://dashboard.render.com/
2. **youtube-oauth-auth** を開く
3. **Settings** タブで以下を確認：

```
Name: youtube-oauth-auth
Environment: Node
Region: Oregon (US West)
Branch: main
Build Command: npm install
Start Command: npm start
```

### 環境変数設定

1. **Environment** タブを開く
2. **Add Environment Variable** で以下を追加：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://vtuber_school_evaluation_user:kWEZaVgrOyWvrZbCPWrSgP46SrIshaNI@dpg-d5ppgkq4d50c73acrj10-a.oregon-postgres.render.com:5432/vtuber_school_evaluation` |
| `YOUTUBE_ANALYTICS_CLIENT_ID` | Google Cloud Consoleから取得 |
| `YOUTUBE_ANALYTICS_CLIENT_SECRET` | Google Cloud Consoleから取得 |
| `YOUTUBE_ANALYTICS_REDIRECT_URI` | `https://youtube-oauth-auth.onrender.com/auth/callback` |

3. **Save Changes** をクリック（自動再デプロイ開始）

---

## 🎯 次のアクション

1. **Renderの環境変数を確認・設定**
   - 4つの環境変数が正しく設定されているか確認
   - 設定されていない場合は追加

2. **Renderのログを確認**
   - Logsタブでエラーメッセージを確認
   - エラー内容を教えてください

3. **Google Cloud Consoleの設定確認**
   - 認証情報 → OAuth 2.0 クライアントID
   - 承認済みのリダイレクトURIに以下が追加されているか確認：
     - `https://youtube-oauth-auth.onrender.com/auth/callback`
     - `https://vtuber-school-evaluation.onrender.com/api/analytics/auth/callback`

---

## 📞 サポート

設定内容やログの内容を教えていただければ、次のステップを案内します。

特に以下の情報があると助かります：
- Renderの環境変数設定状況（スクリーンショット可）
- Renderのログ（Logsタブの内容）
- Google Cloud Consoleのリダイレクト URI設定状況
