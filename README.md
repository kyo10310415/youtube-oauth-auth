# YouTube Analytics OAuth認証アプリ

生徒が管理者から受け取った一回限りの認証コードを使い、自分のYouTubeアカウントを登録するWebアプリです。学籍番号だけで認証を開始する旧方式は廃止しました。

## 配備前の準備

既存の `DATABASE_URL`、`YOUTUBE_ANALYTICS_CLIENT_ID`、`YOUTUBE_ANALYTICS_CLIENT_SECRET`、`YOUTUBE_ANALYTICS_REDIRECT_URI` を維持します。redirect URIはこのサービスのHTTPS origin上の `/auth/callback` にします。

新しく `YOUTUBE_INVITE_ADMIN_TOKEN` を設定してください。他用途と共有しないランダム英数字64文字を推奨します（最低32文字）。チャット・Git・配布用ファイルへ記載しないでください。

管理者が `migrations/001_oauth_invitations.sql` を対象DBで明示的に実行し、招待用テーブルを作成してから配備します。install/start時にはmigrationを実行しません。既存の `youtube_oauth_tokens` テーブル・保存済み連携は変更しません。

Buildは `npm ci`、Startは `npm start`。隔離環境での依存導入は `npm ci --ignore-scripts`、回帰確認は `npm test` を使用します。

## 管理者の招待発行

信頼できる管理端末の環境に `YOUTUBE_INVITE_ADMIN_TOKEN` を設定し、次を実行します。独自ドメインの場合は `YOUTUBE_OAUTH_ORIGIN` をHTTPS originへ設定します。

```sh
node scripts/create-invitation.js <student-id> <new-private-file-outside-repository>
```

スクリプトはコードを画面へ出さず、新規ファイルへ保存します。既存ファイルは上書きしません。ファイルは秘密情報として扱い、対象生徒に確認済みの私的な経路でコードとサイトURLを渡し、配布後は管理端末上のファイルを削除します。Windowsでは保存先フォルダーのアクセス権も確認してください。

管理APIは `POST /admin/invitations`、JSON `{ "studentId": "<student-id>" }` とBearer管理キーが必要です。応答の招待コードは認証情報なので、画面共有・アクセスログ・解析ツールへ出力しないでください。招待は24時間有効で、認証開始時に消費します。管理者は配布先本人と学籍番号を照合する必要があります。

## 生徒の操作

1. サイトのトップページを開きます。
2. 管理者から受け取った認証コードを入力します。
3. Googleの認証画面で自分のチャンネルを選び、アクセスを許可します。
4. 完了画面が出たら閉じます。

コードを持っている人が登録できるため、他人へ転送しないでください。中断・失敗・10分以上の経過・サービス再起動・デプロイ中の場合は、管理者へ再発行を依頼します。同じブラウザで複数の認証を同時に開始しないでください。

## セキュリティと運用上の制限

- 招待の保存先学籍番号は信頼された管理APIだけが指定します。公開APIの学籍番号指定は使用しません。
- DBには招待コードのSHA256ハッシュだけを保存し、開始時の原子的DELETEで一度だけ消費します。期限切れ招待は管理者の保守計画で削除できます。
- ランダムstateを10分間サーバーに保持し、開始ブラウザのSecure/HttpOnly/SameSite=Lax Cookieと照合します。照合前にはトークン交換・保存を行いません。stateはトークン交換前に単回消費します。
- stateは単一プロセスメモリに保持します。複数インスタンスは共有ストアへ移行するまで非対応です。再起動時は安全に拒否し、新しい招待で再試行します。
- Googleのaccess/refresh tokenは既存どおりPostgreSQLに保存します。本アプリによるDB列の暗号化は行っていません。DB・バックアップ・ログのアクセス制御を別途管理してください。
- Googleアカウント本人性はGoogleの認証、対象生徒への登録権限は管理者の個別招待で担保します。生徒本人のログイン基盤を追加したものではありません。

## 既存連携への影響

評価システム等から `/?studentId=...` で開いていたリンクは、トップページを開くだけになります。学籍番号で認証は開始できません。管理者が対象生徒の招待を事前発行・個別配布する運用へ切り替えてから配備してください。呼出元に招待の自動発行機能を追加する場合は、別途その呼出元の権限と配布先検証が必要です。

### 2026-10-25 第12バッチ依存更新

Hono/Node adapterを既存manifest範囲内でlock更新。認証・API・業務コード・DBスキーマ・環境設定は変更しません。Node22.23.4でinstall scripts無効のclean install、8テスト、差分チェック成功。HTTP adapterの保護付き静的配信・エンコードされたパス・JSON処理は架空fixtureで検証。

稼働用audit: Critical0/High0/Moderate0/Low0。全依存audit: Critical0/High0/Moderate0/Low0。警告件数と実際の攻撃成立は別に評価します。招待リンク・OAuth state・認可とHTTP adapterを検証。実Google OAuth認可・DB保存は未試験。

## PostgreSQL TLS方針（2026-10-26）

`database-config.js`でDB接続設定を統一しています。Render上（RENDER=true）の短いdpg形式の内部ホストのみ自己署名証明書を許容してTLS必須とし、それ以外の接続先は証明書とホスト名を検証します。Render内部の自己署名は[公式仕様](https://render.com/docs/postgresql-creating-connecting)に合わせた例外で、内部ネットワークの信頼に依存します。

URLのssl*・uselibpqcompatによる検証方針の上書きを防ぎます。sslrootcert/sslcert/sslkeyのCA・クライアント証明書ファイルは読込み後のssl設定へ保持します。hostクエリとNODE_TLS_REJECT_UNAUTHORIZED=0は拒否し、失敗時に非検証・平文へ戻しません。独自CAや非標準の内部ホストでは信頼設定の確認が必要です。

起動ログにはredirect URIを含む環境設定一覧を表示しません。招待方式・保存済みトークン・SQLは変更しません。実DBの証明書/接続成功とGoogle同意・保存の試験は今回未実施です。
