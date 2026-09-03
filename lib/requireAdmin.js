import crypto from "crypto";

// Perlindungan untuk laluan /api/admin/*.
// Frontend admin perlu hantar header:  x-admin-secret: <ADMIN_API_SECRET>
// Ini bukan sistem log masuk penuh - sesuai buat sekarang, tapi
// disyorkan naik taraf ke Supabase Auth + peranan admin kemudian.
//
// Tambahan keselamatan (audit):
// 1. Had kadar cubaan log masuk gagal (dalam memori) - elak cubaan
//    brute-force pantas terhadap ADMIN_API_SECRET. Ini perlindungan
//    "best-effort" (reset bila fungsi serverless cold-start semula),
//    bukan gantian kepada kata laluan yang kuat & rawak.
// 2. Perbandingan "timing-safe" - elak serangan `timing attack` yang
//    cuba teka kata laluan aksara demi aksara berdasarkan masa tindak
//    balas pelayan.
const failedAttempts = new Map(); // ip -> [timestamp, ...]
const WINDOW_MS = 15 * 60 * 1000; // 15 minit
const MAX_ATTEMPTS = 8;

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Tetap buat perbandingan (terhadap diri sendiri) supaya masa yang diambil
    // konsisten - elak panjang kata laluan sebenar bocor melalui masa tindak balas.
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireAdmin(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const recent = (failedAttempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Terlalu banyak percubaan log masuk gagal. Sila cuba lagi selepas 15 minit." });
    return false;
  }

  const provided = req.headers["x-admin-secret"];
  const expected = process.env.ADMIN_API_SECRET;
  const valid = !!expected && safeCompare(provided, expected);

  if (!valid) {
    recent.push(now);
    failedAttempts.set(ip, recent);
    res.status(401).json({ error: "Tidak dibenarkan." });
    return false;
  }

  return true;
}
