import nodemailer from "nodemailer";

// ============================================================
// Emel - guna Gmail SMTP terus dengan App Password akaun Gmail admin.
// Tetapkan GMAIL_USER & GMAIL_APP_PASSWORD di Environment Variables.
// ============================================================
function buildMessageText(booking, adminLink) {
  return [
    `TEMPAHAN BARU - Nurul Yaqeen Enterprise`,
    `Lot: ${booking.lot_number}`,
    `Nama Penyewa: ${booking.renter_name}`,
    `No. Plat Kenderaan: ${booking.plate_number}`,
    `Pakej: ${booking.package_label || booking.package_id}`,
    `Jumlah: RM ${Number(booking.total_price).toFixed(2)}`,
    `Kaedah Bayaran: ${booking.payment_method === "online" ? "Online (Billplz - telah disahkan automatik)" : "Pindahan Bank"}`,
    `Tempoh: ${booking.start_date} hingga ${booking.end_date}`,
    ``,
    `Sila semak & sahkan tempahan ini:`,
    adminLink,
  ].join("\n");
}

async function sendAdminEmail(booking, adminLink) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("[notify] GMAIL_USER/GMAIL_APP_PASSWORD belum ditetapkan - emel dilangkau.");
    return { skipped: true };
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const attachments = [];
  if (booking.proofImageDataUrl) {
    const match = booking.proofImageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      attachments.push({
        filename: `bukti-bayaran-${booking.lot_number}.${match[1].split("/")[1]}`,
        content: Buffer.from(match[2], "base64"),
      });
    }
  }

  await transporter.sendMail({
    from: `"Sistem Tempahan Parkir" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: `Tempahan Baru - Lot ${booking.lot_number} (${booking.renter_name})`,
    text: buildMessageText(booking, adminLink),
    attachments,
  });
  return { sent: true };
}

// ============================================================
// WhatsApp - guna Green API (servis QR-scan, free tier kekal untuk
// sehingga 3 chat - sesuai untuk notifikasi peribadi/perniagaan kecil).
// Tetapkan GREEN_API_URL, GREEN_API_ID_INSTANCE, GREEN_API_TOKEN_INSTANCE
// & GREEN_API_ADMIN_CHAT (contoh: 60197635707@c.us) di Environment Variables.
// ============================================================
async function sendAdminWhatsapp(booking, adminLink) {
  const { GREEN_API_URL, GREEN_API_ID_INSTANCE, GREEN_API_TOKEN_INSTANCE, GREEN_API_ADMIN_CHAT } = process.env;
  if (!GREEN_API_URL || !GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE || !GREEN_API_ADMIN_CHAT) {
    console.warn("[notify] Pembolehubah Green API belum lengkap - WhatsApp dilangkau.");
    return { skipped: true };
  }
  const text = buildMessageText(booking, adminLink);
  const url = `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: GREEN_API_ADMIN_CHAT, message: text }),
    });
    const body = await res.text();
    return { sent: res.ok, body };
  } catch (err) {
    console.error("[notify] WhatsApp gagal:", err);
    return { sent: false, error: String(err) };
  }
}

// ============================================================
// Fungsi utama - panggil ini selepas tempahan/bayaran selesai.
// Sengaja "best effort": jika emel/WhatsApp gagal, ia tidak
// menggagalkan keseluruhan proses tempahan pelanggan.
// ============================================================
export async function notifyAdmin(booking) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tempahanparking-nye.vercel.app";
  const adminLink = `${siteUrl}?admin=1`;

  const [emailResult, waResult] = await Promise.allSettled([
    sendAdminEmail(booking, adminLink),
    sendAdminWhatsapp(booking, adminLink),
  ]);

  return {
    email: emailResult.status === "fulfilled" ? emailResult.value : { error: String(emailResult.reason) },
    whatsapp: waResult.status === "fulfilled" ? waResult.value : { error: String(waResult.reason) },
  };
}
