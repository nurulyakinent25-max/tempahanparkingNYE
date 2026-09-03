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
    // Bebaskan lot yang tempoh sewaannya sudah tamat, dan batalkan
    // tempahan "menunggu" yang ditinggalkan tanpa bayaran (>30 minit).
    await Promise.all([
      supabaseAdmin.rpc("expire_old_bookings"),
      supabaseAdmin.rpc("expire_stale_pending_bookings"),
    ]);

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

    // Ambil no. plat & tarikh tamat untuk lot yang sedang disewa/menunggu.
    const bookingIds = lots.filter((l) => l.current_booking_id).map((l) => l.current_booking_id);
    let bookingInfo = {};
    if (bookingIds.length > 0) {
      const { data: bks } = await supabaseAdmin
        .from("bookings")
        .select("id, plate_number, end_date, package_id, qty, confirmed_at")
        .in("id", bookingIds);
      (bks || []).forEach((b) => (bookingInfo[b.id] = b));
    }

    const lotsWithInfo = lots.map((l) => {
      const info = l.current_booking_id ? bookingInfo[l.current_booking_id] : null;
      // Kira masa TEPAT sepadan dengan bila admin sahkan tempahan, untuk
      // SEMUA pakej (bukan Harian sahaja) - supaya paparan konsisten.
      let untilDisplay = info?.end_date || null;
      if (info && info.confirmed_at) {
        if (info.package_id === "harian") {
          // Pakej Harian: tamat TEPAT 24 jam x bilangan hari dari masa disahkan.
          const exact = new Date(info.confirmed_at);
          exact.setHours(exact.getHours() + info.qty * 24);
          untilDisplay = exact.toISOString();
        } else if (info.end_date) {
          // Pakej lain: kekalkan tarikh akhir (end_date) tetapi guna masa
          // TEPAT sepadan dengan waktu sebenar tempahan disahkan.
          const confirmedTime = new Date(info.confirmed_at);
          const [y, m, d] = info.end_date.split("-").map(Number);
          const combined = new Date(Date.UTC(
            y, m - 1, d,
            confirmedTime.getUTCHours(), confirmedTime.getUTCMinutes(), confirmedTime.getUTCSeconds()
          ));
          untilDisplay = combined.toISOString();
        }
      }
      return {
        lot_number: l.lot_number,
        zone_code: l.zone_code,
        status: l.status,
        plate_number: info?.plate_number || null,
        end_date: info?.end_date || null,
        until_display: untilDisplay,
        is_daily: info?.package_id === "harian",
      };
    });

    return res.status(200).json({ lots: lotsWithInfo, packages, zones, settings });
  } catch (err) {
    console.error("lots error:", err);
    return res.status(500).json({ error: "Gagal memuatkan data lot." });
  }
}
