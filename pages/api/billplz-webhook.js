import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { computeXSignature } from "../../lib/billplz";
import { notifyAdmin } from "../../lib/notify";

// Billplz hantar application/x-www-form-urlencoded - Next.js bodyParser
// bawaan sudah cukup untuk uraikan ini terus ke req.body (tak perlu raw body
// macam Stripe, sebab tandatangan Billplz dikira daripada nilai medan itu
// sendiri, bukan bait mentah badan permintaan).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { x_signature, ...fields } = req.body || {};

    if (!process.env.BILLPLZ_X_SIGNATURE_KEY) {
      console.error("BILLPLZ_X_SIGNATURE_KEY belum ditetapkan.");
      return res.status(500).json({ error: "Konfigurasi pelayan tidak lengkap." });
    }

    const expected = computeXSignature(fields, process.env.BILLPLZ_X_SIGNATURE_KEY);
    if (!x_signature || expected !== x_signature) {
      console.error("Billplz X-Signature tidak sah - kemungkinan permintaan palsu.");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const billId = fields.id;
    const paid = fields.paid === "true" || fields.paid === true;

    if (billId && paid) {
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("*, packages(label)")
        .eq("billplz_bill_id", billId)
        .single();

      if (booking && booking.payment_status !== "paid") {
        await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            payment_ref: billId,
          })
          .eq("id", booking.id);

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

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("billplz-webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
