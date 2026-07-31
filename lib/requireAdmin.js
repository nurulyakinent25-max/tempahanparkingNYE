// Perlindungan MUDAH untuk laluan /api/admin/*.
// Frontend admin perlu hantar header:  x-admin-secret: <ADMIN_API_SECRET>
// Ini bukan sistem log masuk penuh - sesuai buat sekarang, tapi
// disyorkan naik taraf ke Supabase Auth + peranan admin kemudian.
export function requireAdmin(req, res) {
  const provided = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_API_SECRET || provided !== process.env.ADMIN_API_SECRET) {
    res.status(401).json({ error: "Tidak dibenarkan." });
    return false;
  }
  return true;
}
