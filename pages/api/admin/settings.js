import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    try {
      const [{ data: settings, error: e1 }, { data: packages, error: e2 }] = await Promise.all([
        supabaseAdmin.from("site_settings").select("*").eq("id", 1).single(),
        supabaseAdmin.from("packages").select("*"),
      ]);
      if (e1 || e2) throw e1 || e2;
      return res.status(200).json({ settings, packages });
    } catch (err) {
      console.error("admin/settings GET error:", err);
      return res.status(500).json({ error: "Gagal memuatkan tetapan." });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { settings, packages } = req.body; // kedua-dua pilihan (partial)

      if (settings) {
        const { error } = await supabaseAdmin.from("site_settings").update(settings).eq("id", 1);
        if (error) throw error;
      }

      if (Array.isArray(packages)) {
        for (const p of packages) {
          const { error } = await supabaseAdmin
            .from("packages")
            .update({ price: p.price, duration_months: p.duration_months })
            .eq("id", p.id);
          if (error) throw error;
        }
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("admin/settings PATCH error:", err);
      return res.status(500).json({ error: "Gagal mengemaskini tetapan." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
