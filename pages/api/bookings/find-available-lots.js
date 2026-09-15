import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

// Carian pantas: diberi satu pakej + tarikh mula, cari SEMUA lot yang
// layak (ikut zon pakej itu - ATAU semua zon jika Pakej Harian & tarikh
// jatuh dalam "tempoh pengecualian sementara" yang admin tetapkan) yang
// KOSONG untuk tempoh tersebut. Setiap lot dipulangkan dengan zon
// SEBENARNYA sendiri (bukan zon pakej) supaya borang tempahan lanjutan
// tahu pakej mana yang sah untuk lot tersebut.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { package_id, start_date } = req.query;
  if (!package_id || !start_date) {
    return res.status(400).json({ error: "Sila pilih pakej & tarikh." });
  }

  try {
    const [{ data: pkg, error: pkgErr }, { data: settings, error: setErr }] = await Promise.all([
      supabaseAdmin.from("packages").select("*").eq("id", package_id).single(),
      supabaseAdmin.from("site_settings").select("daily_override_start, daily_override_end").eq("id", 1).single(),
    ]);
    if (pkgErr || !pkg) return res.status(400).json({ error: "Pakej tidak ditemui." });
    if (setErr) throw setErr;

    const endDate = pkg.mode === "fixed"
      ? addMonths(start_date, pkg.duration_months)
      : (pkg.unit === "hari" ? addDays(start_date, 1) : addMonths(start_date, 1));

    const overrideActive = package_id === "harian" &&
      settings?.daily_override_start && settings?.daily_override_end &&
      start_date >= settings.daily_override_start && start_date <= settings.daily_override_end;

    const lotsQuery = overrideActive
      ? supabaseAdmin.from("lots").select("lot_number, zone_code").order("lot_number")
      : supabaseAdmin.from("lots").select("lot_number, zone_code").eq("zone_code", pkg.zone_code).order("lot_number");

    const { data: candidateLots, error: lotsErr } = await lotsQuery;
    if (lotsErr) throw lotsErr;

    if (candidateLots.length === 0) {
      return res.status(200).json({ availableLots: [], endDate, overrideActive });
    }

    const lotNumbers = candidateLots.map((l) => l.lot_number);
    const { data: conflicting, error: confErr } = await supabaseAdmin
      .from("bookings")
      .select("lot_number")
      .in("lot_number", lotNumbers)
      .in("status", ["menunggu_admin", "disahkan"])
      .lte("start_date", endDate)
      .gte("end_date", start_date);
    if (confErr) throw confErr;

    const busySet = new Set((conflicting || []).map((c) => c.lot_number));
    const availableLots = candidateLots
      .filter((l) => !busySet.has(l.lot_number))
      .map((l) => ({ lot_number: l.lot_number, zone_code: l.zone_code }));

    return res.status(200).json({ availableLots, endDate, overrideActive });
  } catch (err) {
    console.error("find-available-lots error:", err);
    return res.status(500).json({ error: "Gagal mencari lot kosong." });
  }
}
