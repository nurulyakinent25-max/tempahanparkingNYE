import { supabaseAdmin } from "./supabaseAdmin";

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// Had kadar mudah: tolak jika lebih daripada `limit` tempahan dicipta
// dari IP yang sama dalam tempoh `windowMinutes`. "Fail-open" - jika
// jadual rate_limits sendiri bermasalah, tempahan SAH tetap diteruskan
// (elak had kadar sendiri jadi punca sistem tempahan gagal).
export async function checkRateLimit(req, { action = "create_booking", limit = 3, windowMinutes = 10 } = {}) {
  const ip = getClientIp(req);
  const key = `${action}:${ip}`;

  try {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { count, error } = await supabaseAdmin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("rl_key", key)
      .gte("created_at", since);

    if (error) return { allowed: true }; // fail-open

    if ((count || 0) >= limit) {
      return { allowed: false, message: "Terlalu banyak percubaan tempahan dalam masa singkat. Sila cuba lagi selepas beberapa minit." };
    }

    await supabaseAdmin.from("rate_limits").insert({ rl_key: key });
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail-open - jangan halang tempahan sah
  }
}
