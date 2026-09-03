import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Endpoint AWAM tapi selamat - hanya boleh diakses jika tahu UUID
// tempahan tepat (rawak, tidak boleh diteka). Hanya pulangkan medan
// TIDAK sensitif untuk cetak resit sendiri (bukan IC/telefon/gambar).
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID tempahan diperlukan." });

  try {
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("id, lot_number, renter_name, total_price, payment_method, payment_status, start_date, end_date, created_at, paid_at, confirmed_at, packages(label)")
      .eq("id", id)
      .single();

    if (error || !booking) return res.status(404).json({ error: "Tempahan tidak ditemui." });

    return res.status(200).json({
      receipt: {
        id: booking.id,
        lot_number: booking.lot_number,
        renter_name: booking.renter_name,
        total_price: booking.total_price,
        payment_method: booking.payment_method,
        payment_status: booking.payment_status,
        start_date: booking.start_date,
        end_date: booking.end_date,
        created_at: booking.created_at,
        paid_at: booking.paid_at,
        confirmed_at: booking.confirmed_at,
        package_label: booking.packages?.label,
      },
    });
  } catch (err) {
    console.error("receipt error:", err);
    return res.status(500).json({ error: "Gagal memuatkan resit." });
  }
}
