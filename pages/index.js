import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, Car, Lock, Search, Bell, Settings, CheckCircle2, XCircle,
  Upload, PenTool, ChevronRight, ChevronLeft, AlertCircle,
  Trash2, Eye, X, MessageCircle, Mail, ShieldCheck, Loader2,
} from "lucide-react";
import { api, adminHeaders } from "../lib/apiClient";
import FloorPlan from "../components/FloorPlan";

/* ============================================================
   Warna & label zon (paparan sahaja - data sebenar datang dari DB)
   ============================================================ */
const ZONE_META = {
  A: { color: "blue" },
  B: { color: "teal" },
  C: { color: "amber" },
};
const COLOR_MAP = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", ring: "ring-blue-500", chip: "bg-blue-100 text-blue-700" },
  teal: { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-700", ring: "ring-teal-500", chip: "bg-teal-100 text-teal-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", ring: "ring-amber-500", chip: "bg-amber-100 text-amber-700" },
};

const fmtRM = (n) => `RM ${Number(n || 0).toFixed(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
function fmtDateMY(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("ms-MY", { day: "2-digit", month: "long", year: "numeric" });
}
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().slice(0, 10);
}
function calcTotal(pkg, qty) {
  if (!pkg) return 0;
  return pkg.mode === "fixed" ? Number(pkg.price) : Number(pkg.price) * Math.max(1, qty || 1);
}
function calcEndDate(pkg, start, qty) {
  if (!pkg) return start;
  if (pkg.mode === "fixed") return addMonths(start, pkg.duration_months);
  return pkg.unit === "hari" ? addDays(start, Math.max(1, qty || 1)) : addMonths(start, Math.max(1, qty || 1));
}

function resizeImage(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function generateContractText(b, pkg, settings) {
  return [
    `PERJANJIAN SEWAAN TAPAK PARKIR`,
    `Perjanjian ini dibuat pada ${fmtDateMY(b.start_date)} di antara:\n\n1. ${settings.landlord_name}, No. Kad Pengenalan ${settings.landlord_ic}, wakil kepada Nurul Yaqeen Enterprise, beralamat di Lot 7959, Jalan Anggerik, 86400 Parit Raja, Johor, yang selepas ini dirujuk sebagai "Tuan Tanah";\n\nDAN\n\n2. ${b.renter_name}, No. Kad Pengenalan: ${b.ic_number}, No. Telefon: ${b.phone}, beralamat di ${b.address}, yang selepas ini dirujuk sebagai "Penyewa".`,
    `1. OBJEKTIF PERJANJIAN\nPerjanjian ini bertujuan menetapkan terma sewaan tapak parkir Lot No. ${b.lot_number} yang terletak di ${settings.site_address}. Pemilikan sah kekal pada Tuan Tanah; hak penggunaan diberikan kepada Penyewa mengikut syarat dalam dokumen ini.`,
    `2. TEMPOH SEWAAN\nTempoh sewaan adalah untuk ${pkg.label}, bermula ${fmtDateMY(b.start_date)} sehingga ${fmtDateMY(b.end_date)}, kecuali ditamatkan lebih awal menurut klausa penamatan.`,
    `3. KADAR SEWAAN DAN PEMBAYARAN\n3.1 Penyewa bersetuju membayar jumlah keseluruhan ${fmtRM(b.total_price)} secara penuh bagi tempoh sewaan di atas.\n3.2 Pembayaran hendaklah diselesaikan sepenuhnya sebelum penggunaan lot dibenarkan, melalui ${b.payment_method === "online" ? "Pembayaran Online (Kad/FPX)" : `Pemindahan Bank ke akaun ${settings.bank_account}`}.\n3.3 Kelewatan pembayaran melebihi 2 minggu akan dikenakan penalti RM ${settings.late_fee_per_month} setiap bulan.`,
    `4. SKOP KEGUNAAN\nPenyewa hanya dibenarkan meletak kenderaan jenis ${b.vehicle_type} (Jenama: ${b.vehicle_brand}, Warna: ${b.vehicle_color}, No. Plat: ${b.plate_number}), tanpa aktiviti tambahan yang tidak dibenarkan, dan tidak boleh menyewa semula tanpa kebenaran bertulis Tuan Tanah.`,
    `5. KEWAJIPAN PENYEWA\nPenyewa bertanggungjawab menjaga kebersihan kawasan, membaik-pulih sebarang kerosakan akibat kecuaiannya, mematuhi peraturan pihak berkuasa/pengurusan, dan menanggung sepenuhnya sebarang pertikaian dengan pihak ketiga.`,
    `6. PENAMATAN\nMana-mana pihak boleh menamatkan perjanjian dengan notis bertulis 2 minggu awal. Tuan Tanah berhak menamatkan serta-merta jika berlaku pelanggaran serius.`,
    `7. PENAFIAN LIABILITI\nTuan Tanah tidak bertanggungjawab terhadap kehilangan, kecurian, kerosakan kenderaan, atau insiden lain di kawasan tapak parkir.`,
    `8. PENGESAHAN\nDokumen ini disahkan secara digital oleh Penyewa melalui tandatangan elektronik yang dilampirkan, direkodkan pada ${fmtDateMY(b.created_at || todayStr())}.`,
  ].join("\n\n");
}

/* ============================================================
   SignaturePad
   ============================================================ */
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; hasDrawn.current = true; const { x, y } = pos(e); const ctx = canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(x, y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const { x, y } = pos(e); const ctx = canvasRef.current.getContext("2d"); ctx.lineTo(x, y); ctx.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; if (hasDrawn.current) onChange(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const c = canvasRef.current; const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); hasDrawn.current = false; onChange(null); };

  return (
    <div>
      <canvas ref={canvasRef} width={320} height={130} className="w-full border-2 border-dashed border-slate-300 rounded-lg touch-none bg-white"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <button onClick={clear} type="button" className="mt-2 text-xs text-slate-500 underline">Padam &amp; tandatangan semula</button>
    </div>
  );
}

/* ============================================================
   BookingModal
   ============================================================ */
function BookingModal({ lot, zones, packages, settings, onClose, onSubmitted }) {
  const zone = zones.find((z) => z.code === lot.zone_code);
  const availablePkgs = packages.filter((p) => p.zone_code === lot.zone_code);
  const [step, setStep] = useState(1);
  const [pkgId, setPkgId] = useState(availablePkgs[0]?.id);
  const pkg = packages.find((p) => p.id === pkgId);
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [startDate, setStartDate] = useState(todayStr());
  const [form, setForm] = useState({ renterName: "", ic: "", phone: "", address: "", vehicleType: "Kereta", vehicleBrand: "", vehicleColor: "", plateNumber: "" });
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [signature, setSignature] = useState(null);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const totalPrice = calcTotal(pkg, qty);
  const endDate = calcEndDate(pkg, startDate, qty);
  const updateForm = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleProofFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProofUploading(true);
    try { setProofImage(await resizeImage(file)); }
    catch { setError("Gagal memuat naik bukti pembayaran. Cuba imej lain."); }
    setProofUploading(false);
  };

  const canGoStep3 = form.renterName && form.ic.length === 12 && form.phone.length >= 9 && form.address && form.vehicleBrand && form.vehicleColor && form.plateNumber;
  const canGoStep4 = paymentMethod === "online" ? true : !!proofImage;
  const canSubmit = agree && !!signature;

  const handleSubmit = async () => {
    setError("");
    if (!canSubmit) { setError("Sila lengkapkan tandatangan dan bersetuju dengan terma."); return; }
    setSubmitting(true);
    try {
      const previewBooking = {
        lot_number: lot.lot_number, start_date: startDate, end_date: endDate, total_price: totalPrice,
        renter_name: form.renterName, ic_number: form.ic, phone: form.phone, address: form.address,
        vehicle_type: form.vehicleType, vehicle_brand: form.vehicleBrand, vehicle_color: form.vehicleColor,
        plate_number: form.plateNumber, payment_method: paymentMethod,
      };
      const contractText = generateContractText(previewBooking, pkg, settings);

      const { booking } = await api.post("/api/bookings/create", {
        lot_number: lot.lot_number,
        package_id: pkg.id,
        renter_name: form.renterName,
        ic_number: form.ic,
        phone: form.phone,
        address: form.address,
        vehicle_type: form.vehicleType,
        vehicle_brand: form.vehicleBrand,
        vehicle_color: form.vehicleColor,
        plate_number: form.plateNumber,
        qty,
        start_date: startDate,
        payment_method: paymentMethod,
        contract_text: contractText,
      });

      await api.post("/api/upload", { bookingId: booking.id, type: "signature", dataUrl: signature });
      if (paymentMethod === "transfer" && proofImage) {
        await api.post("/api/upload", { bookingId: booking.id, type: "proof", dataUrl: proofImage });
      }

      if (paymentMethod === "online") {
        const { url } = await api.post("/api/create-checkout-session", { bookingId: booking.id });
        window.location.href = url; // redirect penuh ke Stripe Checkout
        return;
      }

      setResult(booking);
      onSubmitted && onSubmitted();
    } catch (e) {
      setError(e.message || "Berlaku ralat semasa menghantar tempahan. Sila cuba lagi.");
    }
    setSubmitting(false);
  };

  if (result) {
    const waMsg = encodeURIComponent(
      `Tempahan baru diterima!\nLot: ${result.lot_number} (${zone.name})\nPenyewa: ${form.renterName}\nTelefon: ${form.phone}\nPakej: ${pkg.label}\nJumlah: ${fmtRM(totalPrice)}\nKaedah bayaran: Pindahan Bank\nSila semak dashboard admin untuk sahkan.`
    );
    const waLink = settings.admin_whatsapp ? `https://wa.me/${settings.admin_whatsapp}?text=${waMsg}` : null;
    const mailLink = settings.admin_email ? `mailto:${settings.admin_email}?subject=${encodeURIComponent("Tempahan Baru - Lot " + result.lot_number)}&body=${waMsg}` : null;

    return (
      <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center text-center mb-4">
            <CheckCircle2 className="text-green-600 mb-2" size={40} />
            <h3 className="font-bold text-lg text-slate-800">Tempahan Dihantar!</h3>
            <p className="text-sm text-slate-500 mt-1">Lot {result.lot_number} kini "Menunggu Pengesahan Admin". Sila selesaikan pindahan bank &amp; tunggu admin sahkan bukti pembayaran.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-sm mb-4 space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Rujukan Tempahan</span><span className="font-mono font-semibold">{result.id}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Jumlah Bayaran</span><span className="font-semibold">{fmtRM(totalPrice)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tempoh</span><span>{fmtDateMY(result.start_date)} - {fmtDateMY(result.end_date)}</span></div>
          </div>
          <p className="text-xs text-slate-500 mb-2">Beritahu admin sekarang (satu ketik untuk hantar):</p>
          <div className="flex gap-2 mb-4">
            <a href={waLink || "#"} onClick={(e) => !waLink && e.preventDefault()} target="_blank" rel="noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium ${waLink ? "bg-green-600 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a href={mailLink || "#"} onClick={(e) => !mailLink && e.preventDefault()}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium ${mailLink ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
              <Mail size={16} /> Emel
            </a>
          </div>
          {(!waLink || !mailLink) && <p className="text-[11px] text-amber-600 mb-3">Admin belum isi No. WhatsApp/emel di Tetapan.</p>}
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-slate-800 text-white font-medium">Tutup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div><h3 className="font-bold text-slate-800">Tempah Lot {lot.lot_number}</h3><p className="text-xs text-slate-500">{zone.name} · {zone.tagline}</p></div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="flex px-4 pt-3 gap-1">{[1, 2, 3, 4].map((s) => <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-blue-600" : "bg-slate-200"}`} />)}</div>

        <div className="p-4">
          {error && <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-2.5 rounded-lg"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Pilih Pakej</label>
                <div className="grid grid-cols-1 gap-2 mt-1.5">
                  {availablePkgs.map((p) => (
                    <button key={p.id} onClick={() => setPkgId(p.id)} className={`text-left px-3 py-2.5 rounded-lg border text-sm ${pkgId === p.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200"}`}>
                      <div className="font-medium text-slate-800">{p.label}</div>
                      <div className="text-xs text-slate-500">
                        {p.mode === "fixed" ? `${fmtRM(p.price)} / ${p.duration_months} bulan` : `${fmtRM(p.price)} / ${p.unit}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {pkg?.mode === "qty" && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Bilangan {pkg.unit}</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={qtyInput}
                    onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ""); setQtyInput(d); const n = parseInt(d, 10); if (!isNaN(n) && n > 0) setQty(n); }}
                    onBlur={() => { if (qtyInput === "" || parseInt(qtyInput, 10) < 1) { setQtyInput("1"); setQty(1); } }}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700">Tarikh Mula</label>
                <input type="date" value={startDate} min={todayStr()} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Tarikh Tamat</span><span>{fmtDateMY(endDate)}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-slate-600">Jumlah Perlu Bayar</span><span>{fmtRM(totalPrice)}</span></div>
              </div>
              <p className="text-xs text-slate-400">Pembayaran perlu dijelaskan penuh mengikut jumlah pakej di atas — tiada bayaran ansuran/separa.</p>
              <button onClick={() => setStep(2)} className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium flex items-center justify-center gap-1">Seterusnya <ChevronRight size={16} /></button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <input placeholder="Nama Penuh" value={form.renterName} onChange={(e) => updateForm("renterName", e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div>
                <input placeholder="No. Kad Pengenalan (12 digit, tanpa sengkang)" value={form.ic} inputMode="numeric" pattern="[0-9]*" maxLength={12}
                  onChange={(e) => updateForm("ic", e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                {form.ic && form.ic.length !== 12 && <p className="text-[11px] text-amber-600 mt-1">No. KP mesti tepat 12 digit ({form.ic.length}/12)</p>}
              </div>
              <input placeholder="No. Telefon" value={form.phone} inputMode="numeric" pattern="[0-9]*"
                onChange={(e) => updateForm("phone", e.target.value.replace(/[^0-9]/g, ""))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <textarea placeholder="Alamat" value={form.address} onChange={(e) => updateForm("address", e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.vehicleType} onChange={(e) => updateForm("vehicleType", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm"><option>Kereta</option><option>Motosikal</option></select>
                <input placeholder="No. Plat" value={form.plateNumber} onChange={(e) => updateForm("plateNumber", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Jenama Kenderaan" value={form.vehicleBrand} onChange={(e) => updateForm("vehicleBrand", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Warna Kenderaan" value={form.vehicleColor} onChange={(e) => updateForm("vehicleColor", e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium flex items-center justify-center gap-1"><ChevronLeft size={16} /> Kembali</button>
                <button disabled={!canGoStep3} onClick={() => setStep(3)} className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1 ${canGoStep3 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"}`}>Seterusnya <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMethod("transfer")} className={`py-2.5 rounded-lg border text-sm font-medium ${paymentMethod === "transfer" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>Pindahan Bank</button>
                <button onClick={() => setPaymentMethod("online")} className={`py-2.5 rounded-lg border text-sm font-medium ${paymentMethod === "online" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>Online (Kad/FPX)</button>
              </div>

              {paymentMethod === "transfer" ? (
                <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-2">
                  <p>Sila pindahkan <strong>{fmtRM(totalPrice)}</strong> ke:</p>
                  <p className="font-mono font-semibold">{settings.bank_account}</p>
                  <input placeholder="No. Rujukan Transaksi" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  <div>
                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Upload size={13} /> Muat Naik Bukti Pembayaran</label>
                    <input type="file" accept="image/*" onChange={handleProofFile} className="text-sm w-full" />
                    {proofUploading && <p className="text-xs text-slate-400 mt-1">Memproses imej...</p>}
                    {proofImage && <img src={proofImage} alt="Bukti pembayaran" className="mt-2 rounded-lg border max-h-40 object-contain" />}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-2">
                  <p className="text-slate-600">Anda akan diarahkan ke gerbang pembayaran Stripe (Kad/FPX) untuk membayar <strong>{fmtRM(totalPrice)}</strong>.</p>
                  <p className="text-xs text-slate-500">Selepas tandatangan di langkah seterusnya, anda akan dibawa terus ke halaman pembayaran selamat Stripe.</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium flex items-center justify-center gap-1"><ChevronLeft size={16} /> Kembali</button>
                <button disabled={!canGoStep4} onClick={() => setStep(4)} className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1 ${canGoStep4 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"}`}>Seterusnya <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Semak kontrak sewa yang dijana automatik di bawah, kemudian tandatangan untuk mengesahkan.</p>
              <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap bg-slate-50">
                {generateContractText(
                  { lot_number: lot.lot_number, start_date: startDate, end_date: endDate, total_price: totalPrice, renter_name: form.renterName, ic_number: form.ic, phone: form.phone, address: form.address, vehicle_type: form.vehicleType, vehicle_brand: form.vehicleBrand, vehicle_color: form.vehicleColor, plate_number: form.plateNumber, payment_method: paymentMethod },
                  pkg, settings
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1 mb-1"><PenTool size={15} /> Tandatangan Elektronik</label>
                <SignaturePad onChange={setSignature} />
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
                Saya faham dan bersetuju dengan terma dan syarat perjanjian sewaan tapak parkir di atas.
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium flex items-center justify-center gap-1"><ChevronLeft size={16} /> Kembali</button>
                <button disabled={!canSubmit || submitting} onClick={handleSubmit} className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1 ${canSubmit && !submitting ? "bg-green-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Hantar Tempahan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LookupBooking
   ============================================================ */
function LookupBooking({ onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const statusLabel = (s) => ({
    menunggu_admin: { text: "Menunggu Pengesahan", color: "text-amber-600 bg-amber-50" },
    disahkan: { text: "Disahkan", color: "text-green-600 bg-green-50" },
    ditolak: { text: "Ditolak", color: "text-red-600 bg-red-50" },
  }[s] || { text: s, color: "text-slate-500 bg-slate-50" });

  const search = async () => {
    setErr(""); setLoading(true);
    try {
      const { bookings } = await api.get(`/api/bookings/lookup?query=${encodeURIComponent(query.trim())}`);
      setResults(bookings);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Search size={18} /> Semak Tempahan Saya</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-2">Masukkan No. KP (12 digit) atau No. Telefon PENUH yang digunakan semasa tempah.</p>
        <div className="flex gap-2 mb-3">
          <input placeholder="No. KP / No. Telefon" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={search} className="px-3 py-2 rounded-lg bg-blue-600 text-white"><Search size={16} /></button>
        </div>
        {err && <p className="text-sm text-red-500 mb-2">{err}</p>}
        {loading && <p className="text-sm text-slate-400">Mencari...</p>}
        {results && results.length === 0 && <p className="text-sm text-slate-400">Tiada tempahan dijumpai.</p>}
        <div className="space-y-2">
          {results && results.map((r) => (
            <div key={r.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">Lot {r.lot_number} · {r.package_id}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${statusLabel(r.status).color}`}>{statusLabel(r.status).text}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{fmtDateMY(r.start_date)} - {fmtDateMY(r.end_date)} · {fmtRM(r.total_price)} · Bayaran: {r.payment_status}</p>
              {r.admin_note && <p className="text-xs text-slate-500 mt-1">Nota admin: {r.admin_note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AdminDashboard
   ============================================================ */
function AdminDashboard({ adminSecret, zones, onClose, onChanged }) {
  const [tab, setTab] = useState("pending");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [settingsData, setSettingsData] = useState(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [overviewLots, setOverviewLots] = useState([]);

  const h = adminHeaders(adminSecret);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try { const { bookings } = await api.get("/api/admin/bookings", h); setBookings(bookings); } catch {}
    setLoading(false);
  }, [adminSecret]);

  const loadOverview = useCallback(async () => {
    try { const { lots } = await api.get("/api/lots"); setOverviewLots(lots); } catch {}
  }, []);

  const loadSettings = useCallback(async () => {
    try { const data = await api.get("/api/admin/settings", h); setSettingsData(data); } catch {}
  }, [adminSecret]);

  useEffect(() => { loadBookings(); loadOverview(); }, [loadBookings, loadOverview]);
  useEffect(() => { if (tab === "settings" && !settingsData) loadSettings(); }, [tab, settingsData, loadSettings]);

  const openBooking = async (id) => {
    try { const { booking } = await api.get(`/api/admin/bookings/${id}`, h); setSelected(booking); } catch {}
  };

  const decide = async (decision) => {
    if (!selected) return;
    try {
      const { booking } = await api.patch(`/api/admin/bookings/${selected.id}`, { decision }, h);
      setSelected({ ...selected, ...booking });
      loadBookings(); loadOverview(); onChanged && onChanged();
    } catch (e) { alert(e.message); }
  };

  const saveSettings = async () => {
    setSavingCfg(true);
    try {
      await api.patch("/api/admin/settings", { settings: settingsData.settings, packages: settingsData.packages }, h);
    } catch (e) { alert(e.message); }
    setSavingCfg(false);
  };

  const pending = bookings.filter((b) => b.status === "menunggu_admin");
  const statusChip = (s) => ({ menunggu_admin: "text-amber-600 bg-amber-50", disahkan: "text-green-600 bg-green-50", ditolak: "text-red-600 bg-red-50" }[s] || "text-slate-500 bg-slate-50");

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /> Dashboard Admin</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="flex border-b overflow-x-auto shrink-0">
          {[{ key: "pending", label: `Menunggu (${pending.length})`, icon: Bell }, { key: "overview", label: "Ringkasan Zon", icon: MapPin }, { key: "all", label: "Semua Tempahan", icon: Eye }, { key: "settings", label: "Tetapan", icon: Settings }].map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {tab === "overview" && (
            <div className="grid sm:grid-cols-3 gap-3">
              {zones.map((z) => {
                const zl = overviewLots.filter((l) => l.zone_code === z.code);
                const avail = zl.filter((l) => l.status === "available").length;
                const occ = zl.filter((l) => l.status === "occupied").length;
                const pend = zl.filter((l) => l.status === "pending").length;
                const c = COLOR_MAP[ZONE_META[z.code]?.color || "blue"];
                return (
                  <div key={z.code} className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
                    <p className={`text-xs font-bold ${c.text}`}>{z.name} · {z.tagline}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{avail}<span className="text-sm text-slate-400 font-normal"> kosong</span></p>
                    <p className="text-xs text-slate-500">{occ} disewa · {pend} menunggu · {zl.length} jumlah</p>
                  </div>
                );
              })}
            </div>
          )}

          {(tab === "pending" || tab === "all") && !selected && (
            <div className="space-y-2">
              {loading && <p className="text-sm text-slate-400">Memuatkan...</p>}
              {(tab === "pending" ? pending : bookings).length === 0 && !loading && <p className="text-sm text-slate-400">Tiada rekod.</p>}
              {(tab === "pending" ? pending : bookings).map((b) => (
                <button key={b.id} onClick={() => openBooking(b.id)} className="w-full text-left border border-slate-200 rounded-lg p-3 flex items-center justify-between hover:bg-slate-50">
                  <div><p className="text-sm font-medium text-slate-800">Lot {b.lot_number} · {b.renter_name}</p><p className="text-xs text-slate-400">{b.package_id} · {b.phone}</p></div>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusChip(b.status)}`}>{b.status}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div>
              <button onClick={() => setSelected(null)} className="text-xs text-blue-600 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Kembali</button>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-slate-800 mb-1">Maklumat Penyewa</p>
                  <p><span className="text-slate-500">Nama:</span> {selected.renter_name}</p>
                  <p><span className="text-slate-500">IC:</span> {selected.ic_number}</p>
                  <p><span className="text-slate-500">Telefon:</span> {selected.phone}</p>
                  <p><span className="text-slate-500">Alamat:</span> {selected.address}</p>
                  <p><span className="text-slate-500">Kenderaan:</span> {selected.vehicle_type} · {selected.vehicle_brand} · {selected.vehicle_color} · {selected.plate_number}</p>
                  <p className="font-semibold text-slate-800 mt-3 mb-1">Tempahan</p>
                  <p><span className="text-slate-500">Lot:</span> {selected.lot_number}</p>
                  <p><span className="text-slate-500">Pakej:</span> {selected.packages?.label || selected.package_id}</p>
                  <p><span className="text-slate-500">Tempoh:</span> {fmtDateMY(selected.start_date)} - {fmtDateMY(selected.end_date)}</p>
                  <p><span className="text-slate-500">Jumlah:</span> {fmtRM(selected.total_price)}</p>
                  <p><span className="text-slate-500">Bayaran:</span> {selected.payment_method === "online" ? "Online" : "Pindahan Bank"} · Status: {selected.payment_status}</p>
                </div>
                <div className="space-y-3">
                  <div><p className="text-xs font-semibold text-slate-500 mb-1">Bukti Pembayaran</p>{selected.proofUrl ? <img src={selected.proofUrl} alt="Bukti" className="rounded-lg border max-h-40 object-contain" /> : <p className="text-xs text-slate-400">Tiada</p>}</div>
                  <div><p className="text-xs font-semibold text-slate-500 mb-1">Tandatangan</p>{selected.signatureUrl ? <img src={selected.signatureUrl} alt="Tandatangan" className="rounded-lg border bg-white max-h-24 object-contain" /> : <p className="text-xs text-slate-400">Tiada</p>}</div>
                </div>
              </div>
              <details className="mt-3">
                <summary className="text-xs font-semibold text-slate-500 cursor-pointer">Lihat Kontrak Penuh</summary>
                <div className="text-[11px] whitespace-pre-wrap text-slate-600 bg-slate-50 rounded-lg p-3 mt-2 max-h-56 overflow-y-auto">{selected.contract_text}</div>
              </details>
              {selected.status === "menunggu_admin" ? (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => decide("ditolak")} className="flex-1 py-2.5 rounded-lg border border-red-300 text-red-600 font-medium flex items-center justify-center gap-1"><XCircle size={16} /> Tolak</button>
                  <button onClick={() => decide("disahkan")} className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-1"><CheckCircle2 size={16} /> Sahkan Tempahan</button>
                </div>
              ) : (
                <div className="mt-4"><span className={`text-xs px-2 py-1 rounded ${statusChip(selected.status)}`}>{selected.status}</span></div>
              )}
            </div>
          )}

          {tab === "settings" && (
            !settingsData ? <p className="text-sm text-slate-400">Memuatkan tetapan...</p> :
            <div className="space-y-3 max-w-md">
              <div><label className="text-xs text-slate-500">No. WhatsApp Admin (format 60123456789)</label>
                <input value={settingsData.settings.admin_whatsapp || ""} onChange={(e) => setSettingsData({ ...settingsData, settings: { ...settingsData.settings, admin_whatsapp: e.target.value } })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs text-slate-500">Emel Admin</label>
                <input value={settingsData.settings.admin_email || ""} onChange={(e) => setSettingsData({ ...settingsData, settings: { ...settingsData.settings, admin_email: e.target.value } })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-xs text-slate-500">Akaun Bank</label>
                <input value={settingsData.settings.bank_account} onChange={(e) => setSettingsData({ ...settingsData, settings: { ...settingsData.settings, bank_account: e.target.value } })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                {settingsData.packages.map((p, i) => (
                  <div key={p.id}>
                    <label className="text-xs text-slate-500">{p.label} (RM)</label>
                    <input type="number" value={p.price} onChange={(e) => { const packages = [...settingsData.packages]; packages[i] = { ...p, price: +e.target.value }; setSettingsData({ ...settingsData, packages }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                ))}
                <div><label className="text-xs text-slate-500">Penalti Lewat (RM/bulan)</label>
                  <input type="number" value={settingsData.settings.late_fee_per_month} onChange={(e) => setSettingsData({ ...settingsData, settings: { ...settingsData.settings, late_fee_per_month: +e.target.value } })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" /></div>
              </div>
              <button onClick={saveSettings} disabled={savingCfg} className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium flex items-center justify-center gap-2">
                {savingCfg ? <Loader2 size={16} className="animate-spin" /> : null} Simpan Tetapan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   HALAMAN UTAMA
   ============================================================ */
export default function Home() {
  const [boot, setBoot] = useState(null); // { lots, packages, zones, settings }
  const [selectedLot, setSelectedLot] = useState(null);
  const [showLookup, setShowLookup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [checkingPw, setCheckingPw] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadBoot = useCallback(async () => {
    try { setBoot(await api.get("/api/lots")); }
    catch (e) { setLoadError(e.message); }
  }, []);

  useEffect(() => { loadBoot(); }, [loadBoot]);

  const tryAdminLogin = async () => {
    setCheckingPw(true); setPwError("");
    try {
      await api.get("/api/admin/bookings", adminHeaders(pwInput));
      setAdminSecret(pwInput);
      setAdminUnlocked(true);
    } catch {
      setPwError("Kata laluan salah.");
    }
    setCheckingPw(false);
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-red-200 rounded-xl p-5 max-w-sm text-center">
          <AlertCircle className="mx-auto text-red-500 mb-2" size={28} />
          <p className="text-sm text-slate-600">{loadError}</p>
          <p className="text-xs text-slate-400 mt-2">Pastikan environment variables Supabase sudah ditetapkan (lihat .env.local / Vercel Settings).</p>
        </div>
      </div>
    );
  }

  if (!boot) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={28} /></div>;
  }

  const totalAvailable = boot.lots.filter((l) => l.status === "available").length;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car size={22} className="text-blue-400" />
            <div><h1 className="font-bold text-sm leading-tight">Nurul Yaqeen Enterprise</h1><p className="text-[11px] text-slate-400 leading-tight">Tempahan Tapak Parkir · Parit Raja</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLookup(true)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"><Search size={16} /></button>
            <button onClick={() => setShowAdmin(true)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"><Lock size={16} /></button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-center justify-between">
          <div><p className="text-xs text-slate-400">Lot kosong sekarang</p><p className="text-2xl font-bold text-slate-800">{totalAvailable} <span className="text-sm font-normal text-slate-400">/ {boot.lots.length}</span></p></div>
          <MapPin className="text-blue-500" size={28} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
          <div className="bg-white rounded-lg border p-2"><span className="inline-block w-3 h-3 rounded-full bg-green-400 mb-1"></span><p className="text-slate-500">Kosong</p></div>
          <div className="bg-white rounded-lg border p-2"><span className="inline-block w-3 h-3 rounded-full bg-amber-300 mb-1"></span><p className="text-slate-500">Menunggu</p></div>
          <div className="bg-white rounded-lg border p-2"><span className="inline-block w-3 h-3 rounded-full bg-slate-400 mb-1"></span><p className="text-slate-500">Disewa</p></div>
        </div>

        <FloorPlan lots={boot.lots} zones={boot.zones} onSelectLot={setSelectedLot} />
        <p className="text-center text-[11px] text-slate-400 mt-2">Ketik mana-mana lot berwarna untuk membuat tempahan.</p>
      </div>

      {selectedLot && (
        <BookingModal lot={selectedLot} zones={boot.zones} packages={boot.packages} settings={boot.settings}
          onClose={() => setSelectedLot(null)} onSubmitted={loadBoot} />
      )}

      {showLookup && <LookupBooking onClose={() => setShowLookup(false)} />}

      {showAdmin && !adminUnlocked && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xs w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Lock size={16} /> Log Masuk Admin</h3>
              <button onClick={() => { setShowAdmin(false); setPwInput(""); setPwError(""); }}><X size={18} className="text-slate-400" /></button>
            </div>
            <input type="password" placeholder="Kata Laluan Admin" value={pwInput} onChange={(e) => setPwInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryAdminLogin()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2" />
            {pwError && <p className="text-xs text-red-500 mb-2">{pwError}</p>}
            <button onClick={tryAdminLogin} disabled={checkingPw} className="w-full py-2.5 rounded-lg bg-slate-800 text-white font-medium flex items-center justify-center gap-2">
              {checkingPw ? <Loader2 size={16} className="animate-spin" /> : null} Masuk
            </button>
          </div>
        </div>
      )}

      {showAdmin && adminUnlocked && (
        <AdminDashboard adminSecret={adminSecret} zones={boot.zones}
          onClose={() => { setShowAdmin(false); setAdminUnlocked(false); setPwInput(""); setAdminSecret(""); }}
          onChanged={loadBoot} />
      )}
    </div>
  );
}
