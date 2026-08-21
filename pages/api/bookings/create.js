import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// Peraturan harga (disalin daripada supabase/schema.sql jadual `packages`
// supaya jumlah bayaran dikira semula di server - JANGAN percaya
// harga yang dihantar oleh client).
async function getPackage(packageId) {
  const { data, error } = await supabaseAdmin
    .from("packages")
    .select("*")
    .eq("id", packageId)
    .single();
  if (error || !data) throw new Error("Pakej tidak ditemui");
  return data;
}

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const b = req.body;

    // --- Pengesahan asas di server (Fix #4 & #5: IC 12 digit, telefon nombor) ---
    if (!b.ic_number || !/^[0-9]{12}$/.test(b.ic_number)) {
      return res.status(400).json({ error: "No. Kad Pengenalan mesti tepat 12 digit nombor." });
    }
    if (!b.phone || !/^[0-9]{9,15}$/.test(b.phone)) {
      return res.status(400).json({ error: "No. Telefon hanya boleh mengandungi nombor." });
    }
    if (!b.lot_number || !b.package_id || !b.renter_name || !b.address) {
      return res.status(400).json({ error: "Maklumat tempahan tidak lengkap." });
    }

    const pkg = await getPackage(b.package_id);
    const startDate = b.start_date || new Date().toISOString().slice(0, 10);
    const qty = pkg.mode === "qty" ? Math.max(1, parseInt(b.qty) || 1) : 1;

    // --- Kira semula harga & tarikh tamat di SERVER (jangan percaya nilai dari client) ---
    let totalPrice, endDate;
    if (pkg.mode === "fixed") {
      totalPrice = Number(pkg.price);
      endDate = addMonths(startDate, pkg.duration_months);
    } else {
      totalPrice = Number(pkg.price) * qty;
      endDate = pkg.unit === "hari" ? addDays(startDate, qty) : addMonths(startDate, qty);
    }

    const { data, error } = await supabaseAdmin.rpc("create_booking", {
      payload: {
        lot_number: b.lot_number,
        package_id: b.package_id,
        user_id: b.user_id || null,
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
        payment_method: b.payment_method === "online" ? "online" : "transfer",
        contract_text: b.contract_text || null,
      },
    });

    if (error) {
      if (error.message && error.message.includes("LOT_NOT_AVAILABLE")) {
        return res.status(409).json({ error: "Maaf, lot ini baru sahaja ditempah oleh pengguna lain." });
      }
      if (error.message && error.message.includes("ZONE_MISMATCH")) {
        return res.status(400).json({ error: "Pakej yang dipilih tidak sah untuk zon lot ini." });
      }
      if (error.message && error.message.includes("PACKAGE_NOT_FOUND")) {
        return res.status(400).json({ error: "Pakej tidak ditemui." });
      }
      throw error;
    }

    return res.status(200).json({ booking: data });
  } catch (err) {
    console.error("bookings/create error:", err);
    return res.status(500).json({ error: "Gagal mencipta tempahan. Sila cuba lagi." });
  }
}
