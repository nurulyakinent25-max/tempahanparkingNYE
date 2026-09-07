import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

// Batalkan SEMUA lot dalam satu kumpulan tempahan PUKAL sekali gus,
// dikenal pasti melalui batch_id (bukan satu-satu ID tempahan).
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { batch_id } = req.body;
    if (!batch_id) return res.status(400).json({ error: "batch_id diperlukan." });

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "ditolak", admin_note: "Tempahan pukal dibatalkan oleh admin." })
      .eq("batch_id", batch_id)
      .eq("status", "disahkan")
      .select("id");
    if (error) throw error;

    return res.status(200).json({ cancelled: (data || []).length });
  } catch (err) {
    console.error("admin/bookings/cancel-batch error:", err);
    return res.status(500).json({ error: "Gagal membatalkan tempahan pukal." });
  }
}
