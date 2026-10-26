# Render 環境変数設定

## youtube-oauth-auth サービス

Environment タブで以下の環境変数を設定してください：

### DATABASE_URL
```
postgresql://<USER>:<PASSWORD>@<HOST>:5432/<DATABASE>
```

### YOUTUBE_ANALYTICS_CLIENT_ID
```
<既存のvtuber-school-evaluationサービスと同じクライアントID>
```

### YOUTUBE_ANALYTICS_CLIENT_SECRET
```
<既存のvtuber-school-evaluationサービスと同じクライアントシークレット>
```

### YOUTUBE_ANALYTICS_REDIRECT_URI
```
https://youtube-oauth-auth.onrender.com/auth/callback
```

---

## 重要: Google Cloud Consoleの設定更新

**APIとサービス** → **認証情報** → **OAuth 2.0 クライアントID** を編集

**承認済みのリダイレクトURI** に以下を追加:
```
https://youtube-oauth-auth.onrender.com/auth/callback
```

既存のURIも残しておいてください:
```
https://vtuber-school-evaluation.onrender.com/api/analytics/auth/callback
```

両方のURIが設定されている状態にします。


## 認証情報の取扱い（2026-10-26）

過去にこの文書へ記載されていたDB認証情報は使用しないでください。Renderの対象DBで新しい認証情報を発行し、接続するサービスのDATABASE_URLへ保存します。文書のプレースホルダーをそのまま設定せず、値をチャット・Git・ログへ貼らないでください。新しい設定で配備・接続確認後に、旧認証情報を失効させる必要があります。文書からの削除だけでは失効しません。
