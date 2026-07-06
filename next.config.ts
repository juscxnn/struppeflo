import type { NextConfig } from "next";

/**
 * Content-Security-Policy notes:
 * - `script-src 'unsafe-inline'` is required by Next.js static hydration and the
 *   pre-paint theme-init script. Upgrade path: nonce-based CSP via middleware,
 *   which forces dynamic rendering of every route — deliberately deferred.
 * - `connect-src 'self'` is the hard backstop for the local-first promise:
 *   the browser will refuse any cross-origin request even if code regressed.
 */
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is required by the Next.js DEV runtime only (HMR, source
  // maps). Production builds ship without it.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
