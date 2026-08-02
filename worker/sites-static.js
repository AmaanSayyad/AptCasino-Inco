const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

async function fetchAsset(request, env) {
  let response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;
  const url = new URL(request.url);
  if (url.pathname.includes('.')) return response;
  url.pathname = `${url.pathname.replace(/\/$/, '')}/index.html`;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    const response = await fetchAsset(request, env);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(securityHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
