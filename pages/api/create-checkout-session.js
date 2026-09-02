import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { createBill } from "../../lib/billplz";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: "bookingId diperlukan" });

    // Ambil butiran tempahan dari Supabase - JANGAN percaya jumlah harga
    // yang mungkin dihantar terus dari client/browser.
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("id, lot_number, package_id, total_price, payment_status, renter_name, phone, packages(label)")
      .eq("id", bookingId)
      .single();

    if (error || !booking) return res.status(404).json({ error: "Tempahan tidak ditemui" });
    if (booking.payment_status === "paid") {
      return res.status(400).json({ error: "Tempahan ini sudah dibayar" });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const bill = await createBill({
      collectionId: process.env.BILLPLZ_COLLECTION_ID,
      mobile: booking.phone,
      name: booking.renter_name,
      amountSen: Math.round(Number(booking.total_price) * 100), // Billplz guna sen, bukan RM
      description: `Sewaan Lot ${booking.lot_number} - ${booking.packages?.label || booking.package_id}`,
      callbackUrl: `${siteUrl}/api/billplz-webhook`,
      redirectUrl: `${siteUrl}/booking/success?bookingId=${booking.id}`,
    });

    // Simpan Bill ID Billplz supaya webhook boleh padankan semula ke tempahan ini.
    await supabaseAdmin
      .from("bookings")
      .update({ billplz_bill_id: bill.id })
      .eq("id", booking.id);

    return res.status(200).json({ url: bill.url });
  } catch (err) {
    console.error("create-checkout-session (billplz) error:", err);
    return res.status(500).json({ error: err.message || "Gagal mencipta bil pembayaran." });
  }
}
