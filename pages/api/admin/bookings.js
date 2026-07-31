import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    let query = supabaseAdmin
      .from("bookings")
      .select("id, lot_number, package_id, renter_name, phone, status, payment_status, total_price, created_at")
      .order("created_at", { ascending: false });

    if (req.query.status) query = query.eq("status", req.query.status);

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ bookings: data });
  } catch (err) {
    console.error("admin/bookings error:", err);
    return res.status(500).json({ error: "Gagal memuatkan senarai tempahan." });
  }
}
