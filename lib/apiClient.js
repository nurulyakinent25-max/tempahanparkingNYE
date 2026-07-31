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
