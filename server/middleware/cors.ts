export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, "origin");

  // Only allow requests from *.vercel.app domains
  const isAllowedOrigin = origin && /^https:\/\/[\w-]+\.vercel\.app$/.test(origin);

  if (!isAllowedOrigin) {
    return;
  }

  // Handle CORS preflight requests
  if (event.method === "OPTIONS") {
    setResponseHeaders(event, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return null;
  }

  // Set CORS headers for all other requests
  setResponseHeader(event, "Access-Control-Allow-Origin", origin);
});
