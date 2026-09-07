import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Data ini selamat untuk umum (tiada IC/telefon/gambar peribadi) -
// digunakan untuk paparkan pelan tapak, harga pakej & maklumat bank
// di laman utama. No. plat & tarikh tamat sewa DIPAPARKAN untuk lot
// yang disewa supaya pengguna tahu lot itu milik kenderaan mana dan
// bila akan kosong semula (maklumat ini setanding dengan apa yang
// boleh dilihat sesiapa yang lalu di tapak parkir sebenar).
//
// PENTING (reka bentuk baharu): status "Kosong/Menunggu/Disewa" kini
// DIKIRA SECARA DINAMIK setiap kali laman dimuatkan, berdasarkan
// tarikh HARI INI berbanding tempoh (start_date - end_date) tempahan
// AKTIF (menunggu_admin/disahkan) bagi setiap lot - BUKAN lagi
// bergantung pada lajur `lots.status` yang statik. Ini membolehkan
// pelanggan tempah tarikh MASA DEPAN (cth. minggu depan) tanpa lot
// tu terus "hilang" hari ini, sementara sistem tetap menghalang
// pertindihan tarikh (lihat create_booking di pangkalan data).
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    // Batalkan tempahan "menunggu" yang ditinggalkan tanpa bayaran (>30 minit).
    // (Auto-expire lot ikut tarikh tamat sudah tidak diperlukan - status kini
    // dikira dinamik ikut tarikh, jadi ia luput sendiri secara semula jadi.)
    await supabaseAdmin.rpc("expire_stale_pending_bookings");

    const [
      { data: lots, error: e1 },
      { data: packages, error: e2 },
      { data: zones, error: e3 },
      { data: settings, error: e4 },
    ] = await Promise.all([
      supabaseAdmin.from("lots").select("lot_number, zone_code").order("lot_number"),
      supabaseAdmin.from("packages").select("*"),
      supabaseAdmin.from("zones").select("*"),
      supabaseAdmin.from("site_settings").select("*").eq("id", 1).single(),
    ]);
    if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;

    const today = new Date().toISOString().slice(0, 10);

    // Semua tempahan AKTIF (menunggu/disahkan) yang tempohnya meliputi HARI INI.
    const { data: activeToday, error: e5 } = await supabaseAdmin
      .from("bookings")
      .select("lot_number, status, plate_number, end_date, package_id, qty, confirmed_at")
      .in("status", ["menunggu_admin", "disahkan"])
      .lte("start_date", today)
      .gte("end_date", today);
    if (e5) throw e5;

    const byLot = {};
    (activeToday || []).forEach((b) => { byLot[b.lot_number] = b; });

    const lotsWithInfo = lots.map((l) => {
      const info = byLot[l.lot_number];
      let status = "available";
      let untilDisplay = null;

      if (info) {
        status = info.status === "disahkan" ? "occupied" : "pending";
        untilDisplay = info.end_date || null;
        if (info.confirmed_at) {
          if (info.package_id === "harian") {
            // Pakej Harian: tamat TEPAT 24 jam x bilangan hari dari masa disahkan.
            const exact = new Date(info.confirmed_at);
            exact.setHours(exact.getHours() + info.qty * 24);
            untilDisplay = exact.toISOString();
          } else if (info.end_date) {
            // Pakej lain: kekalkan tarikh akhir tetapi guna masa TEPAT
            // sepadan dengan waktu sebenar tempahan disahkan.
            const confirmedTime = new Date(info.confirmed_at);
            const [y, m, d] = info.end_date.split("-").map(Number);
            const combined = new Date(Date.UTC(
              y, m - 1, d,
              confirmedTime.getUTCHours(), confirmedTime.getUTCMinutes(), confirmedTime.getUTCSeconds()
            ));
            untilDisplay = combined.toISOString();
          }
        }
      }

      return {
        lot_number: l.lot_number,
        zone_code: l.zone_code,
        status,
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
