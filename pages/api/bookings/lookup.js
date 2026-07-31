import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// "Semak Tempahan Saya": padan mengikut IC PENUH atau telefon PENUH sahaja
// (bukan carian separa) supaya orang lain tidak boleh cuba teka-teka
// untuk intip rekod penyewa lain.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const q = (req.query.query || "").trim();
  if (q.length < 9) {
    return res.status(400).json({ error: "Sila masukkan No. KP (12 digit) atau No. Telefon penuh." });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("id, lot_number, package_id, status, payment_status, start_date, end_date, total_price, admin_note, created_at")
      .or(`ic_number.eq.${q},phone.eq.${q}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ bookings: data });
  } catch (err) {
    console.error("lookup error:", err);
    return res.status(500).json({ error: "Gagal mencari tempahan." });
  }
}
