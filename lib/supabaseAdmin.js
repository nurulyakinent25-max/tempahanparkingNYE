// Client Supabase untuk KEGUNAAN SERVER SAHAJA (dalam pages/api/*.js).
// Guna SUPABASE_SERVICE_ROLE_KEY yang bypass RLS - JANGAN import
// fail ini dalam mana-mana komponen React / kod yang jalan di browser.
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum ditetapkan. " +
    "Sila isi .env.local (lihat .env.example)."
  );
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
