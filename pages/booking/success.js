import Link from "next/link";
import Head from "next/head";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import { api, printReceipt } from "../../lib/apiClient";

export default function BookingSuccess() {
  const router = useRouter();
  const { bookingId } = router.query;
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/api/bookings/receipt?id=${bookingId}`)
      .then((d) => setReceipt(d.receipt))
      .catch(() => {});
  }, [bookingId]);

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

        {receipt ? (
          <button
            onClick={() => printReceipt(receipt)}
            className="w-full mt-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium flex items-center justify-center gap-2"
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
