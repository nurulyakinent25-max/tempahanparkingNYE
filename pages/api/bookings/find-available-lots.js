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

// Carian pantas: diberi satu pakej + tarikh mula, cari SEMUA lot dalam
// zon pakej itu yang KOSONG untuk tempoh tersebut (unit asas - 1 bulan/
// 1 hari - digunakan sebagai anggaran; kuantiti sebenar boleh dilaras
// semasa pelanggan teruskan tempahan penuh).
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { package_id, start_date } = req.query;
  if (!package_id || !start_date) {
    return res.status(400).json({ error: "Sila pilih pakej & tarikh." });
  }

  try {
    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages").select("*").eq("id", package_id).single();
    if (pkgErr || !pkg) return res.status(400).json({ error: "Pakej tidak ditemui." });

    const endDate = pkg.mode === "fixed"
      ? addMonths(start_date, pkg.duration_months)
      : (pkg.unit === "hari" ? addDays(start_date, 1) : addMonths(start_date, 1));

    const { data: zoneLots, error: lotsErr } = await supabaseAdmin
      .from("lots").select("lot_number").eq("zone_code", pkg.zone_code).order("lot_number");
    if (lotsErr) throw lotsErr;

    const zoneLotNumbers = zoneLots.map((l) => l.lot_number);
    if (zoneLotNumbers.length === 0) {
      return res.status(200).json({ availableLots: [], endDate, zone_code: pkg.zone_code });
    }

    const { data: conflicting, error: confErr } = await supabaseAdmin
      .from("bookings")
      .select("lot_number")
      .in("lot_number", zoneLotNumbers)
      .in("status", ["menunggu_admin", "disahkan"])
      .lte("start_date", endDate)
      .gte("end_date", start_date);
    if (confErr) throw confErr;

    const busySet = new Set((conflicting || []).map((c) => c.lot_number));
    const availableLots = zoneLotNumbers.filter((n) => !busySet.has(n));

    return res.status(200).json({ availableLots, endDate, zone_code: pkg.zone_code });
  } catch (err) {
    console.error("find-available-lots error:", err);
    return res.status(500).json({ error: "Gagal mencari lot kosong." });
  }
}
