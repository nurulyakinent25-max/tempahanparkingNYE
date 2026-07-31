import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Data ini selamat untuk umum (tiada IC/telefon/gambar) - digunakan
// untuk paparkan pelan tapak, harga pakej & maklumat bank di laman utama.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const [
      { data: lots, error: e1 },
      { data: packages, error: e2 },
      { data: zones, error: e3 },
      { data: settings, error: e4 },
    ] = await Promise.all([
      supabaseAdmin.from("lots").select("lot_number, zone_code, status").order("lot_number"),
      supabaseAdmin.from("packages").select("*"),
      supabaseAdmin.from("zones").select("*"),
      supabaseAdmin.from("site_settings").select("*").eq("id", 1).single(),
    ]);
    if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;
    return res.status(200).json({ lots, packages, zones, settings });
  } catch (err) {
    console.error("lots error:", err);
    return res.status(500).json({ error: "Gagal memuatkan data lot." });
  }
}
