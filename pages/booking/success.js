import Link from "next/link";
import Head from "next/head";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, MessageCircle, Mail } from "lucide-react";
import { useRouter } from "next/router";
import { api, printReceipt } from "../../lib/apiClient";

export default function BookingSuccess() {
  const router = useRouter();
  const { bookingId } = router.query;
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/api/bookings/receipt?id=${bookingId}`)
      .then((d) => setReceipt(d.receipt))
      .catch(() => {});
    // Ambil maklumat kenalan admin (WhatsApp/emel) - datang sekali dengan /api/lots.
    api.get("/api/lots")
      .then((d) => setSettings(d.settings))
      .catch(() => {});
  }, [bookingId]);

  const waMsg = receipt && encodeURIComponent(
    `Pembayaran ONLINE diterima!\nLot: ${receipt.lot_number}\nPenyewa: ${receipt.renter_name}\nPakej: ${receipt.package_label || ""}\nJumlah: RM ${Number(receipt.total_price).toFixed(2)}\nSila semak dashboard admin untuk sahkan.`
  );
  const waLink = settings?.admin_whatsapp && waMsg ? `https://wa.me/${settings.admin_whatsapp}?text=${waMsg}` : null;
  const mailLink = settings?.admin_email && waMsg
    ? `mailto:${settings.admin_email}?subject=${encodeURIComponent("Pembayaran Online Diterima - Lot " + (receipt?.lot_number || ""))}&body=${waMsg}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Head><title>Pembayaran Berjaya - Nurul Yaqeen Enterprise</title></Head>
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={44} />
        <h1 className="font-bold text-lg text-slate-800">Pembayaran Berjaya!</h1>
        <p className="text-sm text-slate-500 mt-2">
          Terima kasih. Tempahan anda kini sedang menunggu pengesahan akhir daripada admin.
        </p>
        {bookingId && (
          <p className="text-xs text-slate-400 mt-3 font-mono">Rujukan: {bookingId}</p>
        )}

        {(waLink || mailLink) && (
          <>
            <p className="text-xs text-slate-500 mt-5 mb-2">Beritahu admin sekarang (satu ketik untuk hantar):</p>
            <div className="flex gap-2">
              <a href={waLink || "#"} onClick={(e) => !waLink && e.preventDefault()} target="_blank" rel="noreferrer"
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium ${waLink ? "bg-green-600 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={mailLink || "#"} onClick={(e) => !mailLink && e.preventDefault()}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium ${mailLink ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                <Mail size={16} /> Emel
              </a>
            </div>
          </>
        )}

        {receipt ? (
          <button
            onClick={() => printReceipt(receipt)}
            className="w-full mt-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium flex items-center justify-center gap-2"
          >
            <Download size={16} /> Muat Turun / Cetak Resit
          </button>
        ) : bookingId ? (
          <p className="text-xs text-slate-400 mt-5 flex items-center justify-center gap-1"><Loader2 size={13} className="animate-spin" /> Memuatkan resit...</p>
        ) : null}

        <Link href="/" className="inline-block mt-3 w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium">
          Kembali ke Laman Utama
        </Link>
      </div>
    </div>
  );
}
