import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

async function signedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from("booking-uploads")
    .createSignedUrl(path, 60 * 10); // sah selama 10 minit
  if (error) return null;
  return data.signedUrl;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const { id } = req.query;

  if (req.method === "GET") {
    try {
      const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select("*, packages(label)")
        .eq("id", id)
        .single();
      if (error || !booking) return res.status(404).json({ error: "Tempahan tidak ditemui" });

      const [proofUrl, signatureUrl] = await Promise.all([
        signedUrl(booking.proof_image_url),
        signedUrl(booking.signature_url),
      ]);

      return res.status(200).json({ booking: { ...booking, proofUrl, signatureUrl } });
    } catch (err) {
      console.error("admin booking detail error:", err);
      return res.status(500).json({ error: "Gagal memuatkan tempahan." });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { decision, adminNote } = req.body; // decision: 'disahkan' | 'ditolak'
      if (!["disahkan", "ditolak"].includes(decision)) {
        return res.status(400).json({ error: "Keputusan tidak sah." });
      }

      const { data: booking, error: e1 } = await supabaseAdmin
        .from("bookings")
        .update({ status: decision, admin_note: adminNote || null })
        .eq("id", id)
        .select()
        .single();
      if (e1) throw e1;

      await supabaseAdmin
        .from("lots")
        .update({
          status: decision === "disahkan" ? "occupied" : "available",
          current_booking_id: decision === "disahkan" ? booking.id : null,
        })
        .eq("lot_number", booking.lot_number);

      return res.status(200).json({ booking });
    } catch (err) {
      console.error("admin booking decide error:", err);
      return res.status(500).json({ error: "Gagal mengemaskini tempahan." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
