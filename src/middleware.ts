import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // 1. Bypass Astro internal assets, optimized images, static assets, and media
  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/_image") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/favicon") ||
    /\.(webp|jpg|jpeg|png|gif|svg|ico|mp4|css|js|woff|woff2|ttf|eot)$/i.test(url.pathname)
  ) {
    return await next();
  }

  // 2. Read PREVIEW_USERS JSON string from environment variables
  // Checks Cloudflare runtime environment first, then process.env / import.meta.env
  const previewUsersEnv =
    (context.locals as any)?.runtime?.env?.PREVIEW_USERS ||
    import.meta.env.PREVIEW_USERS ||
    process.env.PREVIEW_USERS ||
    '{"pauldeo":"lovlypreview","devdarla":"Ponderosa2356"}';

  let allowedUsers: Record<string, string> = {};
  try {
    allowedUsers = JSON.parse(previewUsersEnv);
  } catch {
    allowedUsers = { pauldeo: "lovlypreview", devdarla: "Ponderosa2356" };
  }

  // 3. Extract Authorization Header
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
          return await next();
        }
      } catch {
        // Ignore malformed authentication headers
      }
    }
  }

  // 4. Challenge with 401 Unauthorized if not authenticated
  return new Response("Unauthorized access", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Darlalovly Site Preview", charset="UTF-8"',
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
});
