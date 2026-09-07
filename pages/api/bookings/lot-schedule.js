import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Pulangkan tempoh (tarikh) yang SUDAH/SEDANG ditempah untuk satu lot -
// PUBLIK tapi selamat (hanya start_date/end_date, TIADA nama/IC/plat
// pelanggan lain). Digunakan di Langkah 1 borang tempahan supaya
// pelanggan nampak terus tarikh mana yang kosong, macam tempahan hotel.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { lot_number } = req.query;
  if (!lot_number) return res.status(400).json({ error: "lot_number diperlukan." });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("start_date, end_date")
      .eq("lot_number", lot_number)
      .in("status", ["menunggu_admin", "disahkan"])
      .gte("end_date", today) // abaikan tempahan yang dah lepas sepenuhnya
      .order("start_date");
    if (error) throw error;

    return res.status(200).json({ busyRanges: data || [] });
  } catch (err) {
    console.error("lot-schedule error:", err);
    return res.status(500).json({ error: "Gagal memuatkan jadual lot." });
  }
}
