import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";
import { sendWhatsapp } from "../../../../lib/notify";

async function signedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from("booking-uploads")
    .createSignedUrl(path, 60 * 10); // sah selama 10 minit
  if (error) return null;
  return data.signedUrl;
}

function fmtDateMY(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ms-MY", { day: "2-digit", month: "long", year: "numeric" });
}

// Mesej WhatsApp kepada PELANGGAN bila tempahan mereka disahkan admin -
// beritahu lot, tempoh & no. plat, supaya mereka yakin tempahan sah dan
// tahu bila lot tu akan "tertera" plat mereka pada peta tapak.
function buildConfirmationMessage(booking, packageLabel) {
  return [
    `Tempahan Disahkan!`,
    ``,
    `Salam ${booking.renter_name}, tempahan anda di Lot ${booking.lot_number} telah DISAHKAN oleh admin.`,
    ``,
    `Pakej: ${packageLabel}`,
    `Tempoh: ${fmtDateMY(booking.start_date)} - ${fmtDateMY(booking.end_date)}`,
    `No. Plat: ${booking.plate_number || "-"}`,
    ``,
    `Mulai ${fmtDateMY(booking.start_date)}, lot ini akan dikhaskan untuk kenderaan anda dan akan kelihatan pada peta tapak kami.`,
    ``,
    `Terima kasih kerana menempah bersama kami.`,
    `- Nurul Yaqeen Enterprise`,
  ].join("\n");
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

      // Nota reka bentuk baharu: status ketersediaan lot kini DIKIRA SECARA
      // DINAMIK (lihat /api/lots) berdasarkan tarikh tempahan aktif - jadi
      // tiada lagi keperluan kemas kini jadual `lots` di sini. Menukar status
      // tempahan ke 'disahkan'/'ditolak' sudah cukup: ia secara automatik
      // mengubah cara lot ini dikira pada kunjungan /api/lots seterusnya.
      //
      // Bila admin SAHKAN, tandakan payment_status='paid' sekali - admin
      // mengesahkan bermakna bukti pembayaran (Pindahan Bank) telah disemak
      // & diterima. Ini elak "Status Bayaran" kekal "pending" selama-lamanya
      // untuk tempahan Pindahan Bank walaupun sudah disahkan.
      const { data: booking, error: e1 } = await supabaseAdmin
        .from("bookings")
        .update({
          status: decision,
          admin_note: adminNote || null,
          ...(decision === "disahkan" ? { confirmed_at: new Date().toISOString(), payment_status: "paid" } : {}),
        })
        .eq("id", id)
        .select("*, packages(label)")
        .single();
      if (e1) throw e1;

      // Beritahu PELANGGAN melalui WhatsApp (best-effort - tak gagalkan
      // keseluruhan proses kalau WhatsApp gagal dihantar). DIhantar (await)
      // sebelum respons dipulangkan supaya fungsi serverless tak ditamatkan
      // sebelum mesej sempat keluar.
      if (decision === "disahkan" && booking.phone) {
        const packageLabel = booking.packages?.label || "Tempahan Pukal (Lumpsum)";
        try {
          await sendWhatsapp(booking.phone, buildConfirmationMessage(booking, packageLabel));
        } catch (err) {
          console.error("Gagal hantar WhatsApp pengesahan kepada pelanggan:", err);
        }
      }

      return res.status(200).json({ booking });
    } catch (err) {
      console.error("admin booking decide error:", err);
      return res.status(500).json({ error: "Gagal mengemaskini tempahan." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
