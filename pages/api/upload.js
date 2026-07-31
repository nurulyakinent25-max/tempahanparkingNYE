import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Imej (bukti pembayaran / tandatangan) dihantar sebagai base64 dataURL.
// Naikkan had saiz body sebab imej boleh lebih besar daripada 1MB default Next.js.
export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bookingId, type, dataUrl } = req.body; // type: 'proof' | 'signature'
    if (!bookingId || !["proof", "signature"].includes(type) || !dataUrl) {
      return res.status(400).json({ error: "Parameter tidak lengkap." });
    }

    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Format imej tidak sah." });
    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    const ext = contentType.split("/")[1] || "jpg";
    const path = `${type}/${bookingId}.${ext}`;

    // Nota: bucket 'booking-uploads' perlu dicipta dahulu di Supabase Dashboard
    // -> Storage -> New bucket -> nama: booking-uploads -> Private.
    const { error: uploadError } = await supabaseAdmin.storage
      .from("booking-uploads")
      .upload(path, buffer, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    const column = type === "proof" ? "proof_image_url" : "signature_url";
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ [column]: path })
      .eq("id", bookingId);

    if (updateError) throw updateError;

    return res.status(200).json({ path });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ error: "Gagal memuat naik imej." });
  }
}
