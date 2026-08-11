import { stripe } from "../../lib/stripe";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { notifyAdmin } from "../../lib/notify";

// Stripe perlu RAW body (belum di-parse) untuk sahkan tandatangan webhook,
// jadi bodyParser Next.js kena dimatikan untuk route ini sahaja.
export const config = {
  api: { bodyParser: false },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature tidak sah:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            payment_ref: session.payment_intent || session.id,
          })
          .eq("id", bookingId);

        // Bayaran online telah disahkan Stripe - beritahu admin serta-merta.
        const { data: booking } = await supabaseAdmin
          .from("bookings")
          .select("*, packages(label)")
          .eq("id", bookingId)
          .single();
        if (booking) {
          try {
            await notifyAdmin({
              lot_number: booking.lot_number,
              renter_name: booking.renter_name,
              plate_number: booking.plate_number,
              package_label: booking.packages?.label,
              package_id: booking.package_id,
              total_price: booking.total_price,
              payment_method: booking.payment_method,
              start_date: booking.start_date,
              end_date: booking.end_date,
            });
          } catch (e) {
            console.error("notifyAdmin error:", e);
          }
        }
      }
    }

    // Sesi luput tanpa dibayar - biarkan payment_status kekal 'pending'
    // supaya penyewa boleh cuba bayar semula; admin masih boleh lihat rekod.
    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      console.log("Sesi checkout luput untuk booking:", session.metadata?.booking_id);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("stripe-webhook processing error:", err);
    // Balas 500 supaya Stripe cuba hantar semula webhook ini kemudian
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
