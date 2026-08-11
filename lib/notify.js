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
    `Kaedah Bayaran: ${booking.payment_method === "online" ? "Online (Stripe - telah disahkan automatik)" : "Pindahan Bank"}`,
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
// WhatsApp - guna CallMeBot (servis percuma pihak ketiga, untuk
// kegunaan peribadi/perniagaan kecil). Tetapkan CALLMEBOT_PHONE
// & CALLMEBOT_APIKEY di Environment Variables.
// ============================================================
async function sendAdminWhatsapp(booking, adminLink) {
  if (!process.env.CALLMEBOT_PHONE || !process.env.CALLMEBOT_APIKEY) {
    console.warn("[notify] CALLMEBOT_PHONE/CALLMEBOT_APIKEY belum ditetapkan - WhatsApp dilangkau.");
    return { skipped: true };
  }
  const text = buildMessageText(booking, adminLink);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${process.env.CALLMEBOT_PHONE}&text=${encodeURIComponent(text)}&apikey=${process.env.CALLMEBOT_APIKEY}`;
  try {
    const res = await fetch(url);
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
