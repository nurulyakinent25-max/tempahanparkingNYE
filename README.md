# Sistem Tempahan Tapak Parkir — Nurul Yaqeen Enterprise

Projek Next.js **lengkap** (frontend + backend) yang menyambungkan terus ke
Supabase (database) dan Stripe (pembayaran sebenar). Boleh terus di-deploy
ke Vercel.

> **Nota:** `ParkingBookingSystem.jsx` (fail berasingan yang dikongsi lebih
> awal) adalah versi demo yang guna storan dalaman Claude untuk pratonton
> pantas dalam chat. Projek dalam folder ini adalah **versi sebenar** —
> `pages/index.js` ialah UI yang sama tetapi disambungkan terus ke
> `/api/...` (Supabase & Stripe sebenar), dan inilah yang patut di-deploy.

---

## 1. Apa yang anda perlu sediakan (Soalan #6)

Sebelum sistem pembayaran boleh berfungsi, anda perlu:

1. **Akaun Stripe** (stripe.com)
   - Daftar & lengkapkan pengesahan perniagaan (guna butiran Nurul Yaqeen
     Enterprise). Stripe **menyokong perniagaan berdaftar Malaysia**.
   - Dapatkan **Publishable key** & **Secret key**: Dashboard → Developers →
     API keys. Guna kunci `test` dahulu untuk cuba, tukar ke `live` bila dah
     sedia nak terima bayaran sebenar.
   - Selepas laman web di-deploy (langkah 5), kembali ke Dashboard →
     Developers → Webhooks → **Add endpoint**, masukkan
     `https://domain-anda.vercel.app/api/stripe-webhook`, pilih event
     `checkout.session.completed`, kemudian salin **Signing secret**
     (`whsec_...`).

2. **Akaun Supabase** (supabase.com)
   - Cipta projek baharu.
   - Project Settings → API → salin **Project URL**, **anon public key**,
     dan **service_role key** (rahsia — jangan kongsi).
   - Buka **SQL Editor** → jalankan seluruh kandungan `supabase/schema.sql`.
   - Buka **Storage** → cipta bucket baharu bernama `booking-uploads`,
     tetapkan sebagai **Private** (bukan public) — ini simpan gambar bukti
     bayaran & tandatangan.

3. **Nombor WhatsApp Business & emel** anda sendiri — isi kemudian di
   dashboard admin (tab **Tetapan**) selepas laman web live, tak perlu
   masukkan dalam `.env`.

4. **Akaun GitHub & Vercel** (percuma) untuk deploy.

---

## 2. Struktur projek

```
parking-backend/
├── package.json
├── tailwind.config.js / postcss.config.js / styles/globals.css
├── .env.example
├── supabase/schema.sql          <- Jadual: zones, lots, packages, site_settings, profiles, bookings (Soalan #7)
├── lib/
│   ├── supabaseAdmin.js         <- Client Supabase (server-only, service role)
│   ├── stripe.js                <- Client Stripe
│   ├── requireAdmin.js          <- Perlindungan asas /api/admin/*
│   └── apiClient.js             <- Helper fetch untuk frontend (selamat, tiada secret)
└── pages/
    ├── _app.js
    ├── index.js                  <- UI PENUH: peta lot, tempahan, admin dashboard
    ├── booking/success.js        <- Halaman selepas bayaran Stripe berjaya
    ├── booking/cancel.js         <- Halaman jika bayaran dibatalkan
    └── api/
        ├── lots.js               <- GET status 62 lot + harga pakej + tetapan (public)
        ├── upload.js             <- POST gambar bukti bayar / tandatangan
        ├── create-checkout-session.js  <- Soalan #8: cipta sesi Stripe Checkout
        ├── stripe-webhook.js            <- Soalan #8: dengar pembayaran berjaya
        ├── bookings/
        │   ├── create.js         <- POST tempahan baharu (atomic, anti-double-booking)
        │   └── lookup.js         <- GET semak tempahan sendiri (ikut IC/telefon penuh)
        └── admin/
            ├── bookings.js       <- GET senarai semua tempahan
            ├── bookings/[id].js  <- GET butiran + PATCH sah/tolak tempahan
            └── settings.js       <- GET/PATCH tetapan tapak & harga pakej
```

---

## 3. Pasang & jalankan secara tempatan

```bash
npm install
cp .env.example .env.local
# isi semua nilai dalam .env.local (lihat Bahagian 1)
npm run dev
```

Buka `http://localhost:3000` — ini terus memaparkan laman tempahan penuh
(peta 62 lot, tempahan, admin dashboard di ikon mangga). Kata laluan admin
lalai ialah nilai `ADMIN_API_SECRET` yang anda tetapkan dalam `.env.local`.

---

## 4. Alur pembayaran (Soalan #8)

1. Penyewa isi borang tempahan di `pages/index.js` → hantar
   `POST /api/bookings/create` → harga & tarikh tamat **dikira semula di
   server** (bukan dipercayai dari client).
2. Jika pilih **Online**, frontend hantar
   `POST /api/create-checkout-session` → redirect penuh ke halaman Stripe
   Checkout. Selepas bayar, Stripe hantar pengguna ke `/booking/success`
   dan hantar event `checkout.session.completed` ke
   `POST /api/stripe-webhook` → `payment_status` dikemaskini ke `'paid'`
   secara automatik dalam Supabase.
3. Jika pilih **Pindahan Bank**, frontend upload resit ke `/api/upload`
   selepas tempahan dicipta; admin sahkan secara manual di dashboard.
4. Admin buka ikon mangga di header → log masuk dengan `ADMIN_API_SECRET`
   → tab **Menunggu** → lulus/tolak → status lot dikemaskini automatik
   (`occupied` / `available`).

---

## 5. Go Live: GitHub + Vercel

1. Push kod ini ke repo GitHub baharu:
   ```bash
   git init
   git add .
   git commit -m "Sistem tempahan tapak parkir"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
2. Pergi ke [vercel.com](https://vercel.com) → **Add New Project** → import
   repo GitHub tersebut.
3. Dalam skrin konfigurasi Vercel, buka **Environment Variables** → masukkan
   **setiap** nilai dari `.env.local` anda (Supabase URL/anon/service role,
   Stripe secret/publishable, ADMIN_API_SECRET). `NEXT_PUBLIC_SITE_URL`
   tukar kepada domain Vercel yang akan diberi (cth.
   `https://tempahan-parking.vercel.app`).
4. Klik **Deploy**. Vercel akan hos laman web live secara automatik —
   laman tempahan penuh terus berfungsi di domain tersebut.
5. Kembali ke Stripe Dashboard → Webhooks → tambah endpoint menggunakan URL
   Vercel sebenar (`https://.../api/stripe-webhook`), salin
   **Signing secret** baharu, kemaskini `STRIPE_WEBHOOK_SECRET` di Vercel
   Environment Variables, kemudian **Redeploy**.
6. Buka laman live → klik ikon mangga → log masuk admin → tab **Tetapan**
   → isi No. WhatsApp & Emel admin serta sahkan harga pakej.

---

## 6. Nota keselamatan penting

- `SUPABASE_SERVICE_ROLE_KEY` dan `STRIPE_SECRET_KEY` **hanya** boleh wujud
  di `.env.local` / Vercel Environment Variables — jangan letak dalam kod
  frontend atau commit ke GitHub.
- `/api/admin/*` kini dilindungi kata laluan kongsi (`ADMIN_API_SECRET`)
  sahaja — cukup untuk projek kecil, tapi sesuaikan ke Supabase Auth +
  peranan admin sebelum sistem membesar atau melibatkan lebih ramai staf.
- Jadual `bookings` menyimpan IC & telefon penyewa — data ini sensitif di
  bawah PDPA Malaysia. RLS sudah disekat sepenuhnya (tiada akses public
  langsung); pastikan `ADMIN_API_SECRET` dan semua kunci di atas kekal
  rahsia.

