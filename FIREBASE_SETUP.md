# Panduan Setup Firebase Push Notification

Fitur Push Notification telah diimplementasikan secara kode, namun memerlukan konfigurasi kredensial Firebase agar dapat berfungsi sepenuhnya.

Silakan ikuti langkah-langkah di bawah ini.

## 1. Buat Project di Firebase Console
1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Klik **Add project** dan ikuti langkah-langkahnya (beri nama project, misal: `Tesis Project`).
3. Matikan Google Analytics jika tidak diperlukan (opsional).
4. Klik **Create Project**.

## 2. Konfigurasi Android (Wajib untuk Aplikasi Mobile)
1. Di halaman Overview project Firebase, klik ikon **Android** untuk menambahkan aplikasi.
2. Isi **Android package name**: `com.ctu.ems` (Sesuai dengan `android/app/build.gradle` > `applicationId`).
3. Klik **Register app**.
4. **Download google-services.json**.
5. Simpan file tersebut di folder proyek Anda:
   `android/app/google-services.json`
6. Klik Next terus hingga selesai.

## 3. Konfigurasi iOS (Wajib untuk Aplikasi Mobile)
1. Di halaman Overview project Firebase, klik **Add app** > **iOS**.
2. Isi **iOS bundle ID**: `com.ctu.ems` (Atau sesuaikan dengan Bundle Identifier di Xcode).
3. Klik **Register app**.
4. **Download GoogleService-Info.plist**.
5. Simpan file tersebut di folder proyek Anda:
   `ios/App/App/GoogleService-Info.plist`
   *(Penting: Pastikan file ini juga di-drag & drop ke dalam Xcode di navigasi sebelah kiri agar ter-link dengan benar)*.
6. Klik Next terus hingga selesai.

## 4. Konfigurasi Server-side (Firebase Admin SDK)
Ini diperlukan agar server bisa **mengirim** notifikasi ke HP.

1. Di Firebase Console, klik icon Gear (Settings) > **Project settings**.
2. Masuk ke tab **Service accounts**.
3. Klik tombol **Generate new private key**.
4. File JSON akan terdownload. Buka file tersebut dengan text editor.
5. Buka file `.env.local` di proyek ini.
6. Isi variabel berikut berdasarkan isi file JSON tadi:
   ```env
   FIREBASE_PROJECT_ID="isi-project_id-dari-json"
   FIREBASE_CLIENT_EMAIL="isi-client_email-dari-json"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..." 
   ```
   *(Pastikan mengcopy seluruh isi private key termasuk baris baru/newlines)*.

## 5. Sinkronisasi Project
Setelah menambahkan file konfigurasi, jalankan perintah berikut di terminal untuk menyinkronkan project native:

```bash
npx cap sync
```

## 6. Build Ulang
Karena ada perubahan native configuration, Anda harus build ulang aplikasi di emulator/device:

**Android:**
```bash
npx cap open android
# Lalu jalankan via Android Studio
```

**iOS:**
```bash
npx cap open ios
# Lalu jalankan via Xcode
# Pastikan di Xcode > Signing & Capabilities > Tambahkan "Push Notifications"
# Pastikan di Xcode > Signing & Capabilities > Background Modes > Centang "Remote notifications"
```

## Selesai!
Sekarang aplikasi Anda sudah siap menerima Push Notification.
- Saat user login di HP, token akan otomatis terdaftar.
- Saat ada notifikasi baru (Lembur, Cuti, Payroll), server akan otomatis mengirim notifikasi ke HP.
