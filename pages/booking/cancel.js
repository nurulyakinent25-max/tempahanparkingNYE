import Link from "next/link";
import { XCircle } from "lucide-react";
import { useRouter } from "next/router";

export default function BookingCancel() {
  const router = useRouter();
  const { bookingId } = router.query;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 text-center">
        <XCircle className="mx-auto text-red-500 mb-3" size={44} />
        <h1 className="font-bold text-lg text-slate-800">Pembayaran Dibatalkan</h1>
        <p className="text-sm text-slate-500 mt-2">
          Tempahan anda belum dibayar. Anda boleh cuba bayar semula, atau hubungi admin jika perlu bantuan.
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
