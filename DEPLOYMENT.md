# Panduan Deployment ke Vercel (Production)

Aplikasi ini menggunakan **Next.js** (Frontend & Backend) dan **Supabase** (Database).
Karena Supabase hanya hosting Database, kita perlu meng-host aplikasi Next.js di **Vercel** (hosting partner resmi Next.js).

## 1. Persiapan GitHub
Pastikan semua kode terbaru sudah di-push ke repository GitHub Anda.

## 2. Setup Database Supabase
Pastikan Anda memiliki project Supabase yang aktif.
- Masuk ke [Supabase Dashboard](https://supabase.com/dashboard).
- Buka **Settings > Database > Connection Pooling**.
- Salin `Connection string` (Mode: Transaction) untuk production.
- Salin `Connection string` (Mode: Session) untuk direct connection.

## 3. Setup Supabase Storage
Agar fitur upload foto profil berfungsi:
1. Buka Supabase Dashboard > **Storage**.
2. Buat bucket baru dengan nama **`profiles`**.
3. Pastikan bucket bersifat Public jika ingin foto bisa diakses langsung via URL.
4. Karena backend menggunakan `SUPABASE_SERVICE_ROLE_KEY`, server bisa upload file tanpa terhalang RLS (Row Level Security).

## 4. Deploy ke Vercel
1. Buka [Vercel Dashboard](https://vercel.com/dashboard).
2. Klik **Add New... > Project**.
3. Import repository GitHub project ini.
4. Di bagian **Environment Variables**, tambahkan:

| Variable | Value (Contoh) | Keterangan |
|----------|----------------|------------|
| `DATABASE_URL` | `postgres://...:6543/postgres?pgbouncer=true` | Connection Pooling URL (Transaction Mode) |
| `DIRECT_URL` | `postgres://...:5432/postgres` | Direct URL (Session Mode) |
| `NEXTAUTH_SECRET` | `(generate string acak)` | Kunci enkripsi sesi login |
| `NEXTAUTH_URL` | `https://nama-project.vercel.app` | URL domain Vercel (setelah deploy) |
| `SUPABASE_URL` | `https://[ref].supabase.co` | URL Project Supabase |
| `SUPABASE_ANON_KEY` | `eyJh...` | Public Key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJh...` | Service Role Key (Settings > API). **Wajib** untuk upload file. |

5. Klik **Deploy**.

## 5. Update Aplikasi Mobile (Android/iOS)
Setelah server backend aktif di Vercel, update aplikasi mobile agar terhubung ke server online.

1. Buka file konfigurasi API di kode (`src/config.ts` atau `.env` mobile).
2. Ganti `BASE_URL` menjadi URL Vercel Anda (misal: `https://tesis-project.vercel.app`).
3. Build ulang aplikasi mobile:
   ```bash
   npm run mobile:sync
   npm run mobile:android
   ```
