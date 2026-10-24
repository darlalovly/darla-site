// File: src/middleware.ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, hostname } = context.url;

   if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/_image") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/favicon") ||
    /\.(webp|jpg|jpeg|png|gif|svg|ico|mp4|css|js|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return next();
  }

  if (
    import.meta.env.DEV ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return next();
  }

  const previewUsersEnv =
    (import.meta.env as any)?.PREVIEW_USERS ||
    '{"pauldeo":"lovlypreview","devdarla":"Ponderosa2356"}';

  let allowedUsers: Record<string, string> = {};
  try {
    allowedUsers = JSON.parse(previewUsersEnv);
  } catch {
    allowedUsers = { pauldeo: "lovlypreview", devdarla: "Ponderosa2356" };
  }

  const authHeader =
    context.request.headers.get("authorization") ||
    context.request.headers.get("Authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = atob(encoded);
        const [username, password] = decoded.split(":");
        if (username && allowedUsers[username] === password) {
          return next();
        }
      } catch {}
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