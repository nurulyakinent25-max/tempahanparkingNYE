import crypto from "crypto";

const BILLPLZ_BASE =
  process.env.BILLPLZ_SANDBOX === "true"
    ? "https://www.billplz-sandbox.com/api/v3"
    : "https://www.billplz.com/api/v3";

function authHeader() {
  const key = process.env.BILLPLZ_API_KEY || "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// Format no. telefon Malaysia ke bentuk +60XXXXXXXXX yang Billplz perlukan.
function formatMobile(phone) {
  const p = String(phone || "").replace(/[^0-9]/g, "");
  if (p.startsWith("60")) return `+${p}`;
  if (p.startsWith("0")) return `+60${p.slice(1)}`;
  return `+60${p}`;
}

export async function createBill({ collectionId, mobile, name, amountSen, description, callbackUrl, redirectUrl }) {
  const body = new URLSearchParams();
  body.set("collection_id", collectionId);
  body.set("mobile", formatMobile(mobile));
  body.set("name", name);
  body.set("amount", String(amountSen));
  body.set("description", description.slice(0, 200));
  body.set("callback_url", callbackUrl);
  if (redirectUrl) body.set("redirect_url", redirectUrl);

  const res = await fetch(`${BILLPLZ_BASE}/bills`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message?.[0] || `Billplz ralat (${res.status})`;
    throw new Error(msg);
  }
  return data; // { id, url, ... }
}

// Sahkan x_signature callback Billplz (lihat support.billplz.com/api - X Signature).
// `fields` = semua pasangan kunci-nilai callback KECUALI x_signature itu sendiri.
export function computeXSignature(fields, xSignatureKey) {
  const pairs = Object.keys(fields).map((k) => `${k}${fields[k] ?? ""}`);
  pairs.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const sourceString = pairs.join("|");
  return crypto.createHmac("sha256", xSignatureKey).update(sourceString).digest("hex");
}
