# Petit Nid — Android

Uygulama `www/index.html` (dünkü Petit Nid) + `www/native-shim.js` (Android uyarlamaları).

## APK nasıl alınır
Her push'ta GitHub Actions APK'yı derler → **Releases → "android-latest"** → `PetitNid.apk`.
Telefonda indir → aç → "bilinmeyen kaynaklar"a izin ver → yükle.
Yeni sürümler eskisinin üstüne kurulur, veriler silinmez.

## Uygulamayı güncellemek
`www/index.html` dosyasını değiştir → push → yeni APK otomatik çıkar.

## Play Store (isteğe bağlı)
`PetitNid.aab` kullanılır. Önce kendi anahtarını oluştur ve GitHub Secrets'e ekle:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Notlar
- Veriler telefonda saklanır (internet gerekmez). Yedek: Ayarlar → ⬇ .sqlite (paylaş menüsü açılır).
- Makbuz / yoklama çıktısı: "Partager / Imprimer" ile paylaşılır (PDF/yazdırma).
