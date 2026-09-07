import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

// Senaraikan kumpulan tempahan PUKAL yang masih aktif (disahkan) -
// dikumpulkan ikut batch_id supaya admin nampak SATU baris bagi setiap
// acara/kumpulan pukal, bukan berpuluh baris individu bagi setiap lot.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("id, batch_id, lot_number, renter_name, ic_number, phone, address, start_date, end_date, total_price, created_at")
      .not("batch_id", "is", null)
      .eq("status", "disahkan")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const groups = {};
    (data || []).forEach((b) => {
      if (!groups[b.batch_id]) {
        groups[b.batch_id] = {
          batch_id: b.batch_id,
          renter_name: b.renter_name,
          ic_number: b.ic_number,
          phone: b.phone,
          address: b.address,
          start_date: b.start_date,
          end_date: b.end_date,
          created_at: b.created_at,
          lot_numbers: [],
          total_price: 0,
        };
      }
      groups[b.batch_id].lot_numbers.push(b.lot_number);
      groups[b.batch_id].total_price += Number(b.total_price);
    });

    const batches = Object.values(groups)
      .map((g) => ({ ...g, lot_numbers: g.lot_numbers.sort((a, b) => a - b) }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({ batches });
  } catch (err) {
    console.error("admin/bookings/bulk-batches error:", err);
    return res.status(500).json({ error: "Gagal memuatkan senarai tempahan pukal." });
  }
}
