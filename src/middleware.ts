import { defineMiddleware } from "astro:middleware";

const ALLOWED_USERS: Record<string, string> = {
  pauldeo: "lovlypreview",
  devdarla: "Ponderosa2356",
};

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);

  // Bypass authentication for static assets, public images, and media files to prevent browser asset load 401 failures
  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/favicon") ||
    /\.(webp|jpg|jpeg|png|gif|svg|ico|mp4|css|js)$/i.test(url.pathname)
  ) {
    return next();
  }

  const authHeader = context.request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = atob(encoded);
        const [username, password] = decoded.split(":");

        if (username && password && ALLOWED_USERS[username] === password) {
          return next();
        }
      } catch {
        // Fallback for malformed header strings
      }
    }
  }

  return new Response("Unauthorized access", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Darlalovly Site Preview"',
    },
  });
});