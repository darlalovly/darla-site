import { defineMiddleware } from "astro:middleware";

const ALLOWED_USERS: Record<string, string> = {
  pauldeo: "lovlypreview",
  devdarla: "Ponderosa2356",
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/favicon") ||
    /\.(webp|jpg|jpeg|png|gif|svg|ico|mp4|css|js)$/i.test(url.pathname)
  ) {
    return await next();
  }

  const authHeader = context.request.headers.get("authorization") || context.request.headers.get("Authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = atob(encoded);
        const [username, password] = decoded.split(":");

        if (username && ALLOWED_USERS[username] === password) {
          return await next();
        }
      } catch {
        // Ignore malformed authentication headers
      }
    }
  }

  return new Response("Unauthorized access", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Darlalovly Site Preview", charset="UTF-8"',
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
});