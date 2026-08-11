import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Data ini selamat untuk umum (tiada IC/telefon/gambar peribadi) -
// digunakan untuk paparkan pelan tapak, harga pakej & maklumat bank
// di laman utama. No. plat & tarikh tamat sewa DIPAPARKAN untuk lot
// yang disewa supaya pengguna tahu lot itu milik kenderaan mana dan
// bila akan kosong semula (maklumat ini setanding dengan apa yang
// boleh dilihat sesiapa yang lalu di tapak parkir sebenar).
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    // Bebaskan lot yang tempoh sewaannya sudah tamat, secara automatik.
    await supabaseAdmin.rpc("expire_old_bookings");

    const [
      { data: lots, error: e1 },
      { data: packages, error: e2 },
      { data: zones, error: e3 },
      { data: settings, error: e4 },
    ] = await Promise.all([
      supabaseAdmin.from("lots").select("lot_number, zone_code, status, current_booking_id").order("lot_number"),
      supabaseAdmin.from("packages").select("*"),
      supabaseAdmin.from("zones").select("*"),
      supabaseAdmin.from("site_settings").select("*").eq("id", 1).single(),
    ]);
    if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;

    // Ambil no. plat & tarikh tamat untuk lot yang sedang disewa sahaja.
    const bookingIds = lots.filter((l) => l.current_booking_id).map((l) => l.current_booking_id);
    let bookingInfo = {};
    if (bookingIds.length > 0) {
      const { data: bks } = await supabaseAdmin
        .from("bookings")
        .select("id, plate_number, end_date")
        .in("id", bookingIds);
      (bks || []).forEach((b) => (bookingInfo[b.id] = b));
    }

    const lotsWithInfo = lots.map((l) => {
      const info = l.current_booking_id ? bookingInfo[l.current_booking_id] : null;
      return {
        lot_number: l.lot_number,
        zone_code: l.zone_code,
        status: l.status,
        plate_number: info?.plate_number || null,
        end_date: info?.end_date || null,
      };
    });

    return res.status(200).json({ lots: lotsWithInfo, packages, zones, settings });
  } catch (err) {
    console.error("lots error:", err);
    return res.status(500).json({ error: "Gagal memuatkan data lot." });
  }
}
