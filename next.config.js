const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  ...(process.env.SITES_STATIC_EXPORT === "1"
    ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
    : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/games", destination: "/game", permanent: true }];
  },
  async headers() {
    // Next.js dev-mode Fast Refresh evals its runtime — CSP needs 'unsafe-eval' there or
    // hydration silently crashes (main-app.js throws, animations freeze at their initial state).
    const scriptSrc = process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const securityHeaders = [
      { key: "Content-Security-Policy", value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
