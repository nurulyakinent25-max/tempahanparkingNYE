import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendWhatsapp } from "../../../lib/notify";

function fmtDateMY(dateStr) {
  return new Date(dateStr).toLocaleDateString("ms-MY", { day: "2-digit", month: "long", year: "numeric" });
}

// Dipanggil oleh Vercel Cron sekali sehari (lihat vercel.json). Hantar
// peringatan WhatsApp kepada pelanggan yang tempahannya BERMULA ESOK.
export default async function handler(req, res) {
  // Sahkan permintaan ini datang dari Vercel Cron (kalau CRON_SECRET
  // ditetapkan). Fail-open kalau tiada CRON_SECRET langsung ditetapkan.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("id, lot_number, renter_name, phone, start_date, end_date, plate_number")
      .eq("status", "disahkan")
      .eq("start_date", tomorrowStr)
      .is("reminder_sent_at", null);
    if (error) throw error;

    let sentCount = 0;
    for (const b of bookings || []) {
      const text = [
        `Peringatan Tempahan Tapak Parkir`,
        `Salam ${b.renter_name}, tempahan anda di Lot ${b.lot_number} bermula ESOK (${fmtDateMY(b.start_date)}).`,
        `Kenderaan: ${b.plate_number || "-"}`,
        `Sila pastikan kenderaan tiba tepat pada masa yang ditetapkan.`,
        ``,
        `- Nurul Yaqeen Enterprise`,
      ].join("\n");

      const result = await sendWhatsapp(b.phone, text);
      if (result.sent) {
        await supabaseAdmin.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
        sentCount++;
      }
    }

    return res.status(200).json({ checked: (bookings || []).length, sent: sentCount });
  } catch (err) {
    console.error("cron/send-reminders error:", err);
    return res.status(500).json({ error: "Gagal menghantar peringatan." });
  }
}
