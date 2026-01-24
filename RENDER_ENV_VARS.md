# Render 環境変数設定

## youtube-oauth-auth サービス

Environment タブで以下の環境変数を設定してください：

### DATABASE_URL
```
postgresql://vtuber_school_evaluation_user:kWEZaVgrOyWvrZbCPWrSgP46SrIshaNI@dpg-d5ppgkq4d50c73acrj10-a.oregon-postgres.render.com:5432/vtuber_school_evaluation
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
