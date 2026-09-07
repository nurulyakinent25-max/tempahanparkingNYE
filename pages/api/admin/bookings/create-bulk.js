import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

// Tempahan PUKAL (lumpsum) - admin sahaja. Untuk kes macam pelajar/kumpulan
// yang nak sewa BANYAK lot serentak (cth. keseluruhan tapak) untuk satu
// acara, dengan SATU jumlah bayaran keseluruhan (bukan dikira per-lot ikut
// pakej biasa). Semua-atau-tiada: kalau mana-mana lot bertindih tarikh
// dengan tempahan sedia ada, SELURUH operasi dibatalkan.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const b = req.body;

    if (!b.ic_number || !/^[0-9]{12}$/.test(b.ic_number)) {
      return res.status(400).json({ error: "No. Kad Pengenalan mesti tepat 12 digit nombor." });
    }
    if (!b.phone || !/^[0-9]{9,15}$/.test(b.phone)) {
      return res.status(400).json({ error: "No. Telefon hanya boleh mengandungi nombor." });
    }
    if (!Array.isArray(b.lot_numbers) || b.lot_numbers.length === 0) {
      return res.status(400).json({ error: "Sila pilih sekurang-kurangnya satu lot." });
    }
    if (!b.renter_name || !b.address || !b.start_date || !b.end_date) {
      return res.status(400).json({ error: "Maklumat tempahan tidak lengkap." });
    }
    if (!b.total_price || Number(b.total_price) <= 0) {
      return res.status(400).json({ error: "Sila masukkan jumlah bayaran pukal yang sah." });
    }

    const { data, error } = await supabaseAdmin.rpc("create_bulk_booking", {
      payload: {
        lot_numbers: b.lot_numbers,
        renter_name: b.renter_name,
        ic_number: b.ic_number,
        phone: b.phone,
        address: b.address,
        vehicle_type: b.vehicle_type || null,
        vehicle_brand: b.vehicle_brand || null,
        vehicle_color: b.vehicle_color || null,
        plate_number: b.plate_number || null,
        start_date: b.start_date,
        end_date: b.end_date,
        total_price: b.total_price,
        payment_method: b.payment_method || "tunai",
        contract_text: b.contract_text || null,
      },
    });

    if (error) {
      if (error.message && error.message.includes("BULK_CONFLICT")) {
        const lots = error.message.split("BULK_CONFLICT:")[1]?.trim() || "";
        return res.status(409).json({ error: `Lot berikut sudah ditempah untuk tempoh bertindih: ${lots}. Sila keluarkan lot ini atau tukar tarikh.` });
      }
      throw error;
    }

    return res.status(200).json({ bookings: data });
  } catch (err) {
    console.error("admin/bookings/create-bulk error:", err);
    return res.status(500).json({ error: err.message || "Gagal mencipta tempahan pukal." });
  }
}
