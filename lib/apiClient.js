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
  const rows = [
    ["No. Rujukan Tempahan", b.id],
    ["Lot", b.lot_number],
    ["Nama Penyewa", b.renter_name],
    ["Pakej", b.package_label || b.package_id],
    ["Tempoh", `${fmtDate(b.start_date)} - ${fmtDate(b.end_date)}`],
    ["Jumlah Dibayar", fmtRM(b.total_price)],
    ["Kaedah Bayaran", b.payment_method === "online" ? "Online (Kad/FPX)" : "Pindahan Bank"],
    ["Status Bayaran", b.payment_status === "paid" ? "Telah Dibayar" : "Menunggu Pengesahan"],
    ["Tarikh Tempahan", fmtDate(b.created_at || new Date().toISOString())],
  ];

  const win = window.open("", "_blank", "width=420,height=650");
  if (!win) return; // popup disekat pelayar
  win.document.write(`
    <!DOCTYPE html><html><head><title>Resit Tempahan - Lot ${b.lot_number}</title>
    <style>
      body { font-family: ui-monospace, "Courier New", monospace; padding: 24px; color: #1e293b; }
      h1 { font-size: 15px; text-align: center; margin: 0 0 4px; }
      p.sub { text-align: center; color: #64748b; font-size: 11px; margin: 0 0 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      td { padding: 6px 0; border-bottom: 1px dashed #cbd5e1; vertical-align: top; }
      td.label { color: #64748b; width: 45%; }
      td.value { font-weight: 700; text-align: right; }
      .footer { margin-top: 20px; text-align: center; font-size: 10.5px; color: #94a3b8; }
    </style></head><body>
      <h1>RESIT TEMPAHAN TAPAK PARKIR</h1>
      <p class="sub">Nurul Yaqeen Enterprise &middot; Parit Raja</p>
      <table>${rows.map(([l, v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join("")}</table>
      <p class="footer">Sila simpan resit ini sebagai bukti tempahan anda.</p>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
}
