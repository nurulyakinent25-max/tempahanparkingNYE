// Helper fetch ringkas untuk panggil API routes sendiri (/api/...).
// Fail ini selamat dijalankan di browser - tiada secret di sini.
async function request(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* respons kosong */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `Ralat pelayan (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path, headers) => request(path, { method: "GET", headers }),
  post: (path, body, headers) => request(path, { method: "POST", body, headers }),
  patch: (path, body, headers) => request(path, { method: "PATCH", body, headers }),
};

export const adminHeaders = (secret) => ({ "x-admin-secret": secret });

// Buka tetingkap baharu berisi resit tempahan yang dikemas untuk cetak/simpan
// sebagai PDF (guna dialog cetak bawaan pelayar - tiada perpustakaan tambahan).
export function printReceipt(b) {
  const fmtRM = (n) => `RM ${Number(n || 0).toFixed(2)}`;
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("ms-MY", { day: "2-digit", month: "long", year: "numeric" }) : "-");
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("ms-MY", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

  // Masa TEPAT bayaran/tempahan disahkan (kalau ada) - lebih tepat drpd tarikh sahaja.
  const confirmedMoment = b.paid_at || b.confirmed_at || null;

  const rows = [
    ["No. Rujukan Tempahan", b.id],
    ["Lot", b.lot_number],
    ["Nama Penyewa", b.renter_name],
    ["Pakej", b.package_label || b.package_id],
    ["Tempoh", `${fmtDate(b.start_date)} - ${fmtDate(b.end_date)}`],
    ["Jumlah Dibayar", fmtRM(b.total_price)],
    ["Kaedah Bayaran", b.payment_method === "online" ? "Online (Kad/FPX)" : "Pindahan Bank"],
    ["Status Bayaran", b.payment_status === "paid" ? "Telah Dibayar" : "Menunggu Pengesahan"],
    ...(confirmedMoment ? [["Masa Disahkan", fmtDateTime(confirmedMoment)]] : []),
    ["Tarikh Tempahan", fmtDate(b.created_at || new Date().toISOString())],
  ];

  const logoUrl = `${window.location.origin}/logo-company.jpg`;

  const win = window.open("", "_blank", "width=420,height=680");
  if (!win) return; // popup disekat pelayar
  win.document.write(`
    <!DOCTYPE html><html><head><title>Resit Tempahan - Lot ${b.lot_number}</title>
    <style>
      body { font-family: ui-monospace, "Courier New", monospace; padding: 24px; color: #1e293b; }
      .logo { display: block; margin: 0 auto 14px; width: 72px; height: 72px; border-radius: 10px; object-fit: cover; }
      h1 { font-size: 15px; text-align: center; margin: 0 0 4px; }
      p.sub { text-align: center; color: #64748b; font-size: 11px; margin: 0 0 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      td { padding: 6px 0; border-bottom: 1px dashed #cbd5e1; vertical-align: top; }
      td.label { color: #64748b; width: 45%; }
      td.value { font-weight: 700; text-align: right; }
      .footer { margin-top: 20px; text-align: center; font-size: 10.5px; color: #94a3b8; }
    </style></head><body>
      <img class="logo" src="${logoUrl}" alt="Logo Nurul Yaqeen Enterprise" />
      <h1>RESIT TEMPAHAN TAPAK PARKIR</h1>
      <p class="sub">Nurul Yaqeen Enterprise &middot; Parit Raja</p>
      <table>${rows.map(([l, v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join("")}</table>
      <p class="footer">Sila simpan resit ini sebagai bukti tempahan anda.</p>
      <script>window.onload = () => setTimeout(() => window.print(), 350);</script>
    </body></html>
  `);
  win.document.close();
}

// Buka tetingkap baharu berisi PERJANJIAN SEWAAN penuh (dengan tandatangan
// pelanggan dilampirkan) untuk dicetak/simpan sebagai PDF - salinan peribadi
// pelanggan selepas tempahan berjaya dihantar.
export function printAgreement({ contractText, signatureDataUrl, lotNumber }) {
  const logoUrl = `${window.location.origin}/logo-company.jpg`;
  const paragraphsHtml = (contractText || "")
    .split("\n\n")
    .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const win = window.open("", "_blank", "width=480,height=760");
  if (!win) return; // popup disekat pelayar
  win.document.write(`
    <!DOCTYPE html><html><head><title>Perjanjian Sewaan - Lot ${lotNumber}</title>
    <style>
      body { font-family: ui-monospace, "Courier New", monospace; padding: 28px; color: #1e293b; line-height: 1.55; }
      .logo { display: block; margin: 0 auto 14px; width: 64px; height: 64px; border-radius: 8px; object-fit: cover; }
      h1 { font-size: 15px; text-align: center; margin: 0 0 4px; }
      p.sub { text-align: center; color: #64748b; font-size: 11px; margin: 0 0 20px; }
      p { font-size: 11.5px; margin: 0 0 10px; }
      .sig-box { margin-top: 26px; border-top: 1px dashed #cbd5e1; padding-top: 14px; }
      .sig-box img { display: block; max-width: 220px; max-height: 90px; border: 1px solid #e2e8f0; border-radius: 6px; margin-top: 6px; }
      .sig-label { font-size: 10.5px; color: #64748b; margin: 0; }
      .footer { margin-top: 22px; text-align: center; font-size: 10px; color: #94a3b8; }
      @media print { body { padding: 14px; } }
    </style></head><body>
      <img class="logo" src="${logoUrl}" alt="Logo Nurul Yaqeen Enterprise" />
      <h1>PERJANJIAN SEWAAN TAPAK PARKIR</h1>
      <p class="sub">Nurul Yaqeen Enterprise &middot; Parit Raja</p>
      ${paragraphsHtml}
      <div class="sig-box">
        <p class="sig-label">Tandatangan Elektronik Penyewa:</p>
        ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Tandatangan" />` : "<p>(Tiada tandatangan direkodkan)</p>"}
      </div>
      <p class="footer">Sila simpan dokumen ini sebagai salinan perjanjian sewaan anda.</p>
      <script>window.onload = () => setTimeout(() => window.print(), 350);</script>
    </body></html>
  `);
  win.document.close();
}
