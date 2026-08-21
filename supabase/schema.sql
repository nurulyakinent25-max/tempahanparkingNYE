-- ============================================================
-- SKEMA DATABASE: Sistem Tempahan Tapak Parkir
-- Nurul Yaqeen Enterprise
--
-- Cara guna:
-- 1. Buka projek Supabase anda -> SQL Editor -> New Query
-- 2. Tampal seluruh fail ini -> Run
-- ============================================================

create extension if not exists "pgcrypto"; -- untuk gen_random_uuid()

-- ------------------------------------------------------------
-- 1. ZONES  (Zon 1 / Zon 2 / Zon 3)
-- ------------------------------------------------------------
create table if not exists zones (
  code text primary key,          -- 'A', 'B', 'C'
  name text not null,             -- 'Zon 1'
  tagline text                    -- 'Pakej Semester'
);

insert into zones (code, name, tagline) values
  ('A', 'Zon 1', 'Pakej Semester'),
  ('B', 'Zon 2', 'Pakej 3 Bulan'),
  ('C', 'Zon 3', 'Bulanan & Harian')
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. LOTS  (61 lot tapak parkir - ini "product" dalam sistem ini)
-- ------------------------------------------------------------
create table if not exists lots (
  lot_number int primary key,
  zone_code text not null references zones(code),
  status text not null default 'available'
    check (status in ('available', 'pending', 'occupied')),
  current_booking_id uuid
);

-- Jana 61 lot & tetapkan zon secara automatik ikut pelan tapak muktamad
-- (lot 62 tidak wujud - ruang itu digunakan untuk papan tanda
-- "Pintu Keluar ke Jalan Utama"):
--   Zon A (Semester): 1-18, 59-61
--   Zon B (3 Bulan):  19-34, 55-58
--   Zon C (Bulanan/Harian): 35-54
insert into lots (lot_number, zone_code)
select n,
  case
    when n between 1 and 18 then 'A'
    when n between 59 and 61 then 'A'
    when n between 19 and 34 then 'B'
    when n between 55 and 58 then 'B'
    when n between 35 and 54 then 'C'
  end
from generate_series(1, 61) as n
on conflict (lot_number) do nothing;

-- ------------------------------------------------------------
-- 3. PACKAGES  (harga & jenis pakej - boleh admin edit terus di DB/dashboard)
-- ------------------------------------------------------------
create table if not exists packages (
  id text primary key,             -- 'semester' | 'tigabulan' | 'bulanan' | 'harian'
  zone_code text not null references zones(code),
  label text not null,
  mode text not null check (mode in ('fixed', 'qty')),  -- fixed = harga tetap, qty = harga x bilangan
  unit text,                        -- 'bulan' | 'hari' (hanya untuk mode='qty')
  price numeric(10,2) not null,     -- harga tetap ATAU harga per unit
  duration_months int,              -- tempoh tetap untuk mode='fixed' (semester/3 bulan)
  updated_at timestamptz default now()
);

insert into packages (id, zone_code, label, mode, unit, price, duration_months) values
  ('semester',  'A', 'Pakej Semester', 'fixed', null,     250.00, 5),
  ('tigabulan', 'B', 'Pakej 3 Bulan',  'fixed', null,     160.00, 3),
  ('bulanan',   'C', 'Pakej Bulanan',  'qty',   'bulan',   60.00, null),
  ('harian',    'C', 'Pakej Harian',   'qty',   'hari',     3.00, null)
on conflict (id) do update set price = excluded.price, duration_months = excluded.duration_months;

-- ------------------------------------------------------------
-- 3b. SITE_SETTINGS  (satu baris - maklumat perniagaan & notifikasi)
--     Tiada data sensitif di sini (semua ini sudah tertera pada
--     kontrak sewa/geran tanah), jadi selamat dibaca oleh public -
--     tapi hanya admin (service role) boleh kemaskini.
-- ------------------------------------------------------------
create table if not exists site_settings (
  id int primary key default 1 check (id = 1),  -- baris tunggal sahaja
  bank_account text not null default '5515 8408 8412 (Nurul Yaqeen Enterprise)',
  landlord_name text not null default 'Abdul Fattah Khairi Bin Hair Zaki',
  landlord_ic text not null default '931014-01-6763',
  site_address text not null default 'PTD 47163 & PTD 47164, Jalan Nurul Yakin, off Jalan Pangsapuri Desa Siswa, 86400 Parit Raja, Johor',
  admin_whatsapp text default '',    -- format 60123456789, untuk link wa.me
  admin_email text default '',
  late_fee_per_month numeric(10,2) not null default 5.00,
  updated_at timestamptz default now()
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4. PROFILES  (akaun penyewa berdaftar - pautan ke Supabase Auth)
--    Guest booking (tanpa akaun) tidak perlukan baris di sini;
--    user_id pada bookings akan kekal NULL untuk tempahan guest.
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  ic_number text check (ic_number ~ '^[0-9]{12}$'),
  phone text check (phone ~ '^[0-9]{9,15}$'),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. BOOKINGS  (setiap tempahan lot - ini "order" dalam sistem ini)
-- ------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  lot_number int not null references lots(lot_number),
  package_id text not null references packages(id),
  user_id uuid references profiles(id),

  -- Maklumat penyewa
  renter_name text not null,
  ic_number text not null check (ic_number ~ '^[0-9]{12}$'),      -- Fix #4: tepat 12 digit nombor
  phone text not null check (phone ~ '^[0-9]{9,15}$'),            -- Fix #5: nombor sahaja
  address text not null,

  -- Maklumat kenderaan
  vehicle_type text not null,       -- 'Kereta' | 'Motosikal'
  vehicle_brand text not null,
  vehicle_color text not null,
  plate_number text not null,

  -- Tempoh & harga
  qty int not null default 1,       -- bilangan bulan/hari (untuk pakej mode='qty')
  start_date date not null,
  end_date date not null,
  total_price numeric(10,2) not null,

  -- Pembayaran
  payment_method text not null check (payment_method in ('online', 'transfer', 'tunai')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  payment_ref text,
  proof_image_url text,
  stripe_session_id text,
  paid_at timestamptz,
  confirmed_at timestamptz, -- masa tepat admin sahkan (untuk auto-clear Pakej Harian tepat 24 jam)

  -- Kontrak & tandatangan
  signature_url text,
  contract_text text,

  -- Status kelulusan admin
  status text not null default 'menunggu_admin'
    check (status in ('menunggu_admin', 'disahkan', 'ditolak')),
  admin_note text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bookings_ic on bookings (ic_number);
create index if not exists idx_bookings_phone on bookings (phone);
create index if not exists idx_bookings_lot on bookings (lot_number);
create index if not exists idx_bookings_status on bookings (status);

-- Auto-kemaskini updated_at setiap kali baris diubah
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bookings_updated_at on bookings;
create trigger trg_bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 5b. FUNGSI: create_booking
--     Kunci baris lot (FOR UPDATE) supaya dua orang tidak boleh
--     tempah lot yang sama serentak (race condition).
-- ------------------------------------------------------------
create or replace function create_booking(payload jsonb)
returns bookings
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_lot_status text;
  v_lot_zone text;
  v_pkg_zone text;
  v_new_booking bookings;
  v_lot_number int := (payload->>'lot_number')::int;
begin
  -- kunci baris lot sehingga transaksi ini selesai
  select status, zone_code into v_lot_status, v_lot_zone from lots where lot_number = v_lot_number for update;

  if v_lot_status is null then
    raise exception 'Lot % tidak wujud', v_lot_number;
  end if;
  if v_lot_status <> 'available' then
    raise exception 'LOT_NOT_AVAILABLE';
  end if;

  -- sahkan pakej yang dipilih memang untuk zon lot ini (elak Zon 1 guna
  -- harga Pakej Harian Zon 3, dsb, walau apa pun laluan API yang panggil)
  select zone_code into v_pkg_zone from packages where id = payload->>'package_id';
  if v_pkg_zone is null then
    raise exception 'PACKAGE_NOT_FOUND';
  end if;
  if v_pkg_zone <> v_lot_zone then
    raise exception 'ZONE_MISMATCH';
  end if;

  insert into bookings (
    lot_number, package_id, user_id, renter_name, ic_number, phone, address,
    vehicle_type, vehicle_brand, vehicle_color, plate_number,
    qty, start_date, end_date, total_price, payment_method, contract_text
  ) values (
    v_lot_number,
    payload->>'package_id',
    nullif(payload->>'user_id','')::uuid,
    payload->>'renter_name',
    payload->>'ic_number',
    payload->>'phone',
    payload->>'address',
    payload->>'vehicle_type',
    payload->>'vehicle_brand',
    payload->>'vehicle_color',
    payload->>'plate_number',
    coalesce((payload->>'qty')::int, 1),
    (payload->>'start_date')::date,
    (payload->>'end_date')::date,
    (payload->>'total_price')::numeric,
    payload->>'payment_method',
    payload->>'contract_text'
  )
  returning * into v_new_booking;

  update lots set status = 'pending', current_booking_id = v_new_booking.id
    where lot_number = v_lot_number;

  return v_new_booking;
end;
$$;

-- ------------------------------------------------------------
-- 5c. FUNGSI: create_booking_admin
--     Untuk pelanggan walk-in/telefon yang admin daftar terus.
--     Berbeza dengan create_booking (pelanggan): tempahan ini terus
--     berstatus 'disahkan' & lot terus 'occupied' (admin sendiri
--     yang mengesahkan pembayaran secara peribadi, jadi tiada
--     tempoh "menunggu_admin").
-- ------------------------------------------------------------
create or replace function create_booking_admin(payload jsonb)
returns bookings
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_lot_status text;
  v_lot_zone text;
  v_pkg_zone text;
  v_new_booking bookings;
  v_lot_number int := (payload->>'lot_number')::int;
begin
  select status, zone_code into v_lot_status, v_lot_zone from lots where lot_number = v_lot_number for update;

  if v_lot_status is null then
    raise exception 'Lot % tidak wujud', v_lot_number;
  end if;
  if v_lot_status <> 'available' then
    raise exception 'LOT_NOT_AVAILABLE';
  end if;

  select zone_code into v_pkg_zone from packages where id = payload->>'package_id';
  if v_pkg_zone is null then
    raise exception 'PACKAGE_NOT_FOUND';
  end if;
  if v_pkg_zone <> v_lot_zone then
    raise exception 'ZONE_MISMATCH';
  end if;

  insert into bookings (
    lot_number, package_id, renter_name, ic_number, phone, address,
    vehicle_type, vehicle_brand, vehicle_color, plate_number,
    qty, start_date, end_date, total_price, payment_method, contract_text,
    payment_status, status, admin_note, confirmed_at
  ) values (
    v_lot_number,
    payload->>'package_id',
    payload->>'renter_name',
    payload->>'ic_number',
    payload->>'phone',
    payload->>'address',
    payload->>'vehicle_type',
    payload->>'vehicle_brand',
    payload->>'vehicle_color',
    payload->>'plate_number',
    coalesce((payload->>'qty')::int, 1),
    (payload->>'start_date')::date,
    (payload->>'end_date')::date,
    (payload->>'total_price')::numeric,
    coalesce(payload->>'payment_method', 'tunai'),
    payload->>'contract_text',
    'paid',
    'disahkan',
    'Didaftarkan terus oleh admin (pelanggan walk-in/telefon)',
    now()
  )
  returning * into v_new_booking;

  update lots set status = 'occupied', current_booking_id = v_new_booking.id
    where lot_number = v_lot_number;

  return v_new_booking;
end;
$$;
--    Prinsip: data sensitif (bookings - ada IC/telefon/gambar) TIDAK
--    didedahkan terus kepada client. Semua bacaan/tulisan bookings
--    berlaku melalui backend API routes (pages/api/...) yang guna
--    SUPABASE_SERVICE_ROLE_KEY (bypass RLS, hanya di server).
--    zones/lots/packages selamat didedahkan (tiada data peribadi).
-- ------------------------------------------------------------
alter table zones enable row level security;
alter table lots enable row level security;
alter table packages enable row level security;
alter table site_settings enable row level security;
alter table profiles enable row level security;
alter table bookings enable row level security;

drop policy if exists "Public boleh baca zones" on zones;
create policy "Public boleh baca zones" on zones for select using (true);

drop policy if exists "Public boleh baca lots" on lots;
create policy "Public boleh baca lots" on lots for select using (true);

drop policy if exists "Public boleh baca packages" on packages;
create policy "Public boleh baca packages" on packages for select using (true);

drop policy if exists "Public boleh baca site_settings" on site_settings;
create policy "Public boleh baca site_settings" on site_settings for select using (true);

drop policy if exists "Pengguna boleh baca profil sendiri" on profiles;
create policy "Pengguna boleh baca profil sendiri" on profiles
  for select using (auth.uid() = id);

drop policy if exists "Pengguna boleh kemaskini profil sendiri" on profiles;
create policy "Pengguna boleh kemaskini profil sendiri" on profiles
  for update using (auth.uid() = id);

-- Sengaja TIADA policy public untuk 'bookings'.
-- Ini bermakna anon key TIDAK boleh baca/tulis bookings terus.
-- Guna service_role key di server (lihat lib/supabaseAdmin.js).

-- ------------------------------------------------------------
-- 7. FUNGSI: expire_old_bookings
--    Lot yang tempoh sewaannya (end_date) sudah lepas akan
--    automatik kembali 'available' untuk ditempah semula.
--    Dipanggil setiap kali /api/lots dimuatkan.
-- ------------------------------------------------------------
create or replace function expire_old_bookings()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update lots
  set status = 'available', current_booking_id = null
  where status = 'occupied'
    and current_booking_id in (
      select b.id from bookings b
      where (
        -- Pakej Harian: tamat TEPAT 24 jam x bilangan hari dari masa admin
        -- sahkan tempahan (bukan sekadar tukar hari kalendar).
        (b.package_id = 'harian' and b.confirmed_at is not null
          and b.confirmed_at + (b.qty * interval '24 hours') < now())
        or
        -- Pakej lain (bulanan/3 bulan/semester): cukup berdasarkan tarikh sahaja.
        (b.package_id <> 'harian' and b.end_date < current_date)
      )
    );
end;
$$;

-- ------------------------------------------------------------
-- 8. FUNGSI: expire_stale_pending_bookings
--    Tempahan berstatus "menunggu_admin" yang bayarannya masih
--    "pending" selepas 30 minit (pelanggan tinggalkan tanpa bayar/
--    upload bukti) dibatalkan automatik & lot dibebaskan semula.
--    Tempahan pindahan bank yang SUDAH upload bukti (menunggu
--    semakan admin) TIDAK terjejas - hanya yang benar2 ditinggalkan.
-- ------------------------------------------------------------
create or replace function expire_stale_pending_bookings()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  stale_ids uuid[];
begin
  select array_agg(id) into stale_ids
  from bookings
  where status = 'menunggu_admin'
    and payment_status = 'pending'
    and created_at < now() - interval '30 minutes';

  if stale_ids is not null then
    update bookings
    set status = 'ditolak',
        admin_note = 'Auto-dibatalkan - tiada pengesahan bayaran dalam masa 30 minit'
    where id = any(stale_ids);

    update lots
    set status = 'available', current_booking_id = null
    where current_booking_id = any(stale_ids);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 9. RATE_LIMITS  (had kadar mudah - elak spam cipta tempahan)
--    Direkod ikut alamat IP pelanggan. Fail-safe: kegagalan baca/tulis
--    jadual ini tidak menghalang tempahan sah (lihat lib/rateLimit.js).
-- ------------------------------------------------------------
create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  rl_key text not null,
  created_at timestamptz default now()
);
create index if not exists idx_rate_limits_key_time on rate_limits (rl_key, created_at);
alter table rate_limits enable row level security;
-- Sengaja tiada policy public - hanya service_role (server) boleh akses.
