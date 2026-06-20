# からだログ PWA / APK 化ガイド

このフォルダには、からだログを **PWA（ホーム画面に追加できるWebアプリ）** および
**APK（Androidアプリ）** にするために必要なファイルが入っています。

```
pwa/
├── index.html            ← アプリ本体（PWA対応済み）
├── manifest.json         ← PWAマニフェスト
├── service-worker.js     ← オフライン対応
├── icons/                ← 各サイズのアイコン
├── twa-manifest.json     ← APK化（Bubblewrap）の設定
├── assetlinks.json       ← APKとサイトを紐付ける検証ファイル
└── README.md             ← このファイル
```

---

## 1. PWAとして公開する（必須・APKの前提でもある）

PWAは **HTTPS** で配信する必要があります。いつものGitHub Pagesが使えます。

### 手順

1. `pwa/` の中身（index.html, manifest.json, service-worker.js, icons/）を
   GitHubリポジトリの `karada-log/` フォルダにアップロードする。
   例: `takaikom.github.io` リポジトリの中に `karada-log/` を作る。

2. 公開URLは次のようになる:
   ```
   https://takaikom.github.io/karada-log/index.html
   ```

3. スマホのブラウザ（iPhoneはSafari、AndroidはChrome）でそのURLを開く。

### ホーム画面に追加

- **iPhone (Safari)**: 共有ボタン → 「ホーム画面に追加」
- **Android (Chrome)**: メニュー(⋮) → 「アプリをインストール」または「ホーム画面に追加」

これだけで、アイコン付きの全画面アプリとして起動できます。オフラインでも開けます。

### 注意
- `manifest.json` の `start_url` / `scope` は相対パス(`./`)にしてあるので、
  `karada-log/` 以外のフォルダ名でもそのまま動きます。
- アプリを更新したら `service-worker.js` の `CACHE_VERSION` の数字を1つ上げると、
  利用者の端末で古いキャッシュが破棄され最新版が反映されます。

---

## 2. APK（Androidアプリ）にする

PWAをそのままAndroidアプリ化する **Bubblewrap (TWA)** を使います。
TWA = Trusted Web Activity。Chromeの仕組みでPWAをネイティブアプリのように動かします。

### 必要なもの
- Node.js（18以上）
- JDK 17
- Android SDK（Android Studio を入れると一緒に入る）

### 手順

#### (1) Bubblewrap をインストール
```bash
npm install -g @bubblewrap/cli
```

#### (2) プロジェクトを初期化
PWAを先に公開しておくこと（上の手順1）。公開URLのmanifestを指定して初期化します。
```bash
bubblewrap init --manifest https://takaikom.github.io/karada-log/manifest.json
```
対話で聞かれる項目は、同梱の `twa-manifest.json` の値を参考に答えてください。
（パッケージ名: `io.github.takaikom.karadalog` など）

※ すでに用意した `twa-manifest.json` をプロジェクトフォルダに置けば、
　 `bubblewrap build` 時にそれが使われます。

#### (3) APKをビルド
```bash
bubblewrap build
```
- 初回は署名鍵(keystore)の作成を求められます。パスワードは必ず控えておく。
- 完成物:
  - `app-release-signed.apk` … 端末に直接入れて使うAPK
  - `app-release-bundle.aab` … Google Play公開用

#### (4) 自分の端末にインストール（Playストアを使わない場合）
```bash
# PCとスマホをUSB接続し、USBデバッグを有効にして
adb install app-release-signed.apk
```
または `app-release-signed.apk` をGoogle Driveに置き、スマホでDLして
「提供元不明のアプリ」を許可してインストール。

#### (5) アドレスバーを消す（重要）
TWAでアドレスバーを非表示にするには、APKとサイトの所有者が同じであることを
**assetlinks.json** で証明する必要があります。

1. 署名証明書のSHA-256を取得:
   ```bash
   bubblewrap fingerprint
   # もしくは
   keytool -list -v -keystore android.keystore -alias android
   ```
   表示された `SHA256:` の値（コロン区切りの16進）をコピー。

2. 同梱の `assetlinks.json` の `sha256_cert_fingerprints` の中身を、その値に差し替える。

3. その `assetlinks.json` を、サイトの **`.well-known`** フォルダに配置して公開:
   ```
   https://takaikom.github.io/.well-known/assetlinks.json
   ```
   ※ GitHub Pagesでは、リポジトリ直下に `.well-known/assetlinks.json` を置く。
   ※ TWAのドメイン直下である必要があるため、`karada-log/` の中ではなく
     **サイトのルート**(`takaikom.github.io/.well-known/`)に置くこと。

4. アプリを再起動すると、数十秒〜数分でアドレスバーが消えます。

---

## 3. よくある質問

**Q. APKにしてもGAS同期は使える？**
A. 使えます。TWAは中身がChromeなので、PWAと同じく通信できます。

**Q. iPhoneでAPK相当のことは？**
A. iOSはAPK非対応です。Safariの「ホーム画面に追加」（PWA）が事実上のアプリ化になります。
   機能はAPemと同等で、オフライン・全画面で動きます。

**Q. データはアプリごとに別？**
A. PWAもAPK(TWA)も同じbrowserストレージ(localStorage)を共有する場合があります。
   端末間の同期はこれまで通りGASの送信/受信で行ってください。

**Q. アイコンを変えたい**
A. `icons/` のPNGを差し替え、`service-worker.js` の `CACHE_VERSION` を上げて再公開。
   APKは `twa-manifest.json` の `iconUrl` を変えて再ビルド。
