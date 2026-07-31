import { stripe } from "../../lib/stripe";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: "bookingId diperlukan" });

    // Ambil butiran tempahan dari Supabase - JANGAN sesekali percaya
    // jumlah harga yang dihantar terus dari client/browser.
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("id, lot_number, package_id, total_price, payment_status, packages(label)")
      .eq("id", bookingId)
      .single();

    if (error || !booking) return res.status(404).json({ error: "Tempahan tidak ditemui" });
    if (booking.payment_status === "paid") {
      return res.status(400).json({ error: "Tempahan ini sudah dibayar" });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "fpx"], // fpx = perbankan dalam talian Malaysia
      currency: "myr",
      line_items: [
        {
          price_data: {
            currency: "myr",
            product_data: {
              name: `Sewaan Lot ${booking.lot_number} - ${booking.packages?.label || booking.package_id}`,
            },
            unit_amount: Math.round(Number(booking.total_price) * 100), // Stripe guna sen, bukan RM
          },
          quantity: 1,
        },
      ],
      metadata: { booking_id: booking.id },
      success_url: `${siteUrl}/booking/success?bookingId=${booking.id}`,
      cancel_url: `${siteUrl}/booking/cancel?bookingId=${booking.id}`,
    });

    // Simpan session id awal-awal supaya webhook mudah dipadankan semula
    await supabaseAdmin
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", booking.id);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return res.status(500).json({ error: "Gagal mencipta sesi pembayaran." });
  }
}
