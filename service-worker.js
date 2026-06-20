/*
  ============================================================
  service-worker.js - からだログ PWA
  オフライン動作のためのキャッシュ管理
  ------------------------------------------------------------
  方針:
  - アプリ本体(index.html)・manifest・アイコンを事前キャッシュ
  - Chart.js等のCDNはネット接続時に取得しキャッシュ（次回オフラインでも動作）
  - 更新時はCACHE_VERSIONを上げると古いキャッシュを破棄
  ============================================================
*/

const CACHE_VERSION = 'karada-log-v1';   // ★アプリ更新時はこの数字を上げる
const CACHE_NAME = 'karada-cache-' + CACHE_VERSION;

/* 事前にキャッシュするローカルファイル */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
];

/* インストール時：必須ファイルを事前キャッシュ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // 新SWを即時有効化
      .catch(err => console.warn('precache failed', err))
  );
});

/* 有効化時：古いバージョンのキャッシュを削除 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* フェッチ時の戦略
   - GASへの通信(script.google.com)は常にネット優先（キャッシュしない）
   - それ以外はキャッシュ優先、無ければネット取得してキャッシュ
*/
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // GAS同期などのAPI通信はキャッシュせず素通し（常に最新）
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    return; // デフォルトのネットワーク処理に任せる
  }

  // GET以外（POST等）はキャッシュ対象外
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;   // キャッシュヒット
      // ネットから取得し、成功したらキャッシュに保存
      return fetch(event.request).then(resp => {
        // 不正・部分応答はキャッシュしない
        if (!resp || resp.status !== 200 || resp.type === 'opaqueredirect') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
        return resp;
      }).catch(() => {
        // オフラインかつ未キャッシュ：HTMLリクエストならindexを返す
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
