import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Semakan ketersediaan tarikh RINGAN (baca sahaja, tiada apa-apa dicipta) -
// dipanggil dari Langkah 1 borang tempahan supaya pelanggan tahu SEGERA
// kalau tarikh yang dipilih bertindih dengan tempahan sedia ada, tanpa
// perlu isi borang penuh dulu sebelum ditolak di langkah akhir.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { lot_number, start_date, end_date } = req.query;
  if (!lot_number || !start_date || !end_date) {
    return res.status(400).json({ error: "Parameter tidak lengkap." });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("lot_number", lot_number)
      .in("status", ["menunggu_admin", "disahkan"])
      .lte("start_date", end_date)
      .gte("end_date", start_date)
      .limit(1);

    if (error) throw error;

    return res.status(200).json({ available: (data || []).length === 0 });
  } catch (err) {
    console.error("check-availability error:", err);
    // Fail-open: kalau semakan sendiri gagal, jangan sekat pengguna - semakan
    // MUKTAMAD tetap berlaku di /api/bookings/create semasa hantar sebenar.
    return res.status(200).json({ available: true, checkFailed: true });
  }
}
