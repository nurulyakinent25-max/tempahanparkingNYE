import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/router";

export default function BookingSuccess() {
  const router = useRouter();
  const { bookingId } = router.query;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-3" size={44} />
        <h1 className="font-bold text-lg text-slate-800">Pembayaran Berjaya!</h1>
        <p className="text-sm text-slate-500 mt-2">
          Terima kasih. Tempahan anda kini sedang menunggu pengesahan akhir daripada admin.
        </p>
        {bookingId && (
          <p className="text-xs text-slate-400 mt-3 font-mono">Rujukan: {bookingId}</p>
        )}
        <Link href="/" className="inline-block mt-5 px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium">
          Kembali ke Laman Utama
        </Link>
      </div>
    </div>
  );
}
