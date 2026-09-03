/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Header keselamatan asas untuk SEMUA laluan.
        source: "/(.*)",
        headers: [
          {
            // Elak laman ini dibenamkan dalam <iframe> laman lain (anti-clickjacking).
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Elak pelayar "meneka" jenis fail (MIME-sniffing) yang boleh membawa risiko XSS.
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Kurangkan maklumat URL rujukan yang dihantar ke laman luar.
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Sekat akses ciri pelayar sensitif (kamera/mikrofon/lokasi) yang tak digunakan.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
