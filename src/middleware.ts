// File: src/middleware.ts

import { defineMiddleware } from "astro:middleware";

const R2_PUBLIC_BASE = 'https://pub-23c94031ab954f6cb120959a02ecef04.r2.dev';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, hostname } = context.url;
  const { request } = context;

  // 1. Capture Cloudflare Zero Trust authenticated identity
  const cfUserEmail = request.headers.get("cf-access-authenticated-user-email");
  (context.locals as any).userEmail = cfUserEmail || "Darla";

  // 2. Proxy /images/* requests to R2 storage with referer-based hotlink protection
  if (pathname.startsWith("/images/")) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererHost = new URL(referer).hostname;
        const isAllowed =
          refererHost === hostname ||
          refererHost.endsWith("darlalovly.com") ||
          refererHost.endsWith(".pages.dev") ||
          refererHost === "localhost" ||
          refererHost === "127.0.0.1";

        if (!isAllowed) {
          return new Response("Forbidden: Hotlinking is not permitted.", {
            status: 403,
            headers: { "Content-Type": "text/plain" },
          });
        }
      } catch {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const candidateUrls = [
      `${R2_PUBLIC_BASE}${pathname}`,
      `${R2_PUBLIC_BASE}${pathname.replace(/^\/images\/posts\//, '/posts/')}`,
      `${R2_PUBLIC_BASE}${pathname.replace(/^\/images\//, '/')}`,
    ];

    for (const targetUrl of candidateUrls) {
      try {
        const response = await fetch(targetUrl);
        if (response.ok && response.body) {
          const headers = new Headers(response.headers);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          headers.set('Access-Control-Allow-Origin', '*');
          return new Response(response.body, {
            status: 200,
            headers,
          });
        }
      } catch {
        continue;
      }
    }
  }

  // 3. Pass static assets and direct media files through without auth
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/_image") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/favicon") ||
    /\.(webp|jpg|jpeg|png|gif|svg|ico|mp4|css|js|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return next();
  }

  // 4. Bypass authentication during local development
  if (
    import.meta.env.DEV ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return next();
  }

  // 5. Zero Trust authenticated sessions bypass all preview checks
  if (cfUserEmail) {
    return next();
  }

  // 6. Enforce HTTP Basic Auth fallback (protects preview & admin until Zero Trust edge rules apply)
  let cfEnv: any = {};
  try {
    // @ts-ignore
    const cfWorkers = await import('cloudflare:workers');
    cfEnv = cfWorkers?.env || {};
  } catch {}

  const previewUsersRaw =
    cfEnv.PREVIEW_USERS ||
    (globalThis as any).process?.env?.PREVIEW_USERS ||
    import.meta.env.PREVIEW_USERS;

  let allowedUsers: Record<string, string> = {};
  if (previewUsersRaw) {
    try {
      allowedUsers = JSON.parse(previewUsersRaw);
    } catch {
      allowedUsers = {};
    }
  }

  // 7. Verify HTTP Basic Auth credentials
  const authHeader =
    context.request.headers.get("authorization") ||
    context.request.headers.get("Authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      try {
        const decoded = atob(encoded);
        const [username, password] = decoded.split(":");
        if (username && allowedUsers[username] && allowedUsers[username] === password) {
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