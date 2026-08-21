import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

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

// Untuk pelanggan walk-in/telefon yang admin daftar terus dari dashboard.
// Tempahan terus disahkan (bukan "menunggu") sebab admin sendiri
// mengesahkan pembayaran (tunai) secara peribadi.
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
    if (!b.lot_number || !b.package_id || !b.renter_name || !b.address) {
      return res.status(400).json({ error: "Maklumat tempahan tidak lengkap." });
    }

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages").select("*").eq("id", b.package_id).single();
    if (pkgErr || !pkg) return res.status(400).json({ error: "Pakej tidak ditemui." });

    const startDate = b.start_date || new Date().toISOString().slice(0, 10);
    const qty = pkg.mode === "qty" ? Math.max(1, parseInt(b.qty) || 1) : 1;

    let totalPrice, endDate;
    if (pkg.mode === "fixed") {
      totalPrice = Number(pkg.price);
      endDate = addMonths(startDate, pkg.duration_months);
    } else {
      totalPrice = Number(pkg.price) * qty;
      endDate = pkg.unit === "hari" ? addDays(startDate, qty) : addMonths(startDate, qty);
    }

    const { data, error } = await supabaseAdmin.rpc("create_booking_admin", {
      payload: {
        lot_number: b.lot_number,
        package_id: b.package_id,
        renter_name: b.renter_name,
        ic_number: b.ic_number,
        phone: b.phone,
        address: b.address,
        vehicle_type: b.vehicle_type,
        vehicle_brand: b.vehicle_brand,
        vehicle_color: b.vehicle_color,
        plate_number: b.plate_number,
        qty,
        start_date: startDate,
        end_date: endDate,
        total_price: totalPrice,
        payment_method: b.payment_method || "tunai",
        contract_text: b.contract_text || null,
      },
    });

    if (error) {
      if (error.message && error.message.includes("LOT_NOT_AVAILABLE")) {
        return res.status(409).json({ error: "Lot ini tidak lagi kosong." });
      }
      throw error;
    }

    return res.status(200).json({ booking: data });
  } catch (err) {
    console.error("admin/bookings/create-manual error:", err);
    return res.status(500).json({ error: "Gagal mencipta tempahan." });
  }
}
