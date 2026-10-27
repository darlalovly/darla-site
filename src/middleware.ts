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
            headers: {
              "Content-Type": "text/plain",
              "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
            },
          });
        }
      } catch {
        return new Response("Forbidden", {
          status: 403,
          headers: {
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
          },
        });
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
          headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
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

  // 3. Edge-level robots.txt crawler disallow
  if (pathname === '/robots.txt') {
    return new Response("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // 4. Pass static assets through with noindex headers
  if (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/_image") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/favicon") ||
    /\.(webp|jpg|jpeg|png|gif|svg|ico|mp4|css|js|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    const res = await next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return res;
  }

  // 5. Bypass authentication during local development
  if (
    import.meta.env.DEV ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    const res = await next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return res;
  }

  // 6. Zero Trust authenticated sessions bypass Basic Auth
  if (cfUserEmail) {
    const res = await next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return res;
  }

  // 7. Resolve runtime credentials across Cloudflare Pages adapter and environment
  const locals = (context.locals as any) || {};
  const runtimeEnv = locals?.runtime?.env || (context as any)?.env || {};

  let cfEnv: any = {};
  try {
    // @ts-ignore
    const cfWorkers = await import('cloudflare:workers');
    cfEnv = cfWorkers?.env || {};
  } catch {}

  const nodeEnv = (globalThis as any).process?.env || {};
  const viteEnv = (import.meta as any).env || {};
  const env = { ...cfEnv, ...runtimeEnv, ...nodeEnv, ...viteEnv };

  let allowedUsers: Record<string, string> = {};
  if (env.PREVIEW_USERS) {
    try {
      allowedUsers = JSON.parse(env.PREVIEW_USERS);
    } catch {
      allowedUsers = {};
    }
  }

  const defaultUser = env.AUTH_USER || "darla";
  const defaultPass = env.AUTH_PASS || "darlalovly2026";
  if (Object.keys(allowedUsers).length === 0) {
    allowedUsers[defaultUser] = defaultPass;
  }

  // 8. Verify HTTP Basic Auth credentials
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
          const res = await next();
          res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
          return res;
        }
      } catch {}
    }
  }

  return new Response("Unauthorized: Private preview requires authentication.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Darlalovly Private Preview", charset="UTF-8"',
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
});