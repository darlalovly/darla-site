import { defineMiddleware } from "astro:middleware";

const ALLOWED_USERS: Record<string, string> = {
  pauldeo: "lovlypreview",
  devdarla: "Ponderosa2356",
};

export const onRequest = defineMiddleware((context, next) => {
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
        // Handle malformed base64 headers safely
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