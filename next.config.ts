import type { NextConfig } from "next";

/**
 * Content-Security-Policy notes:
 * - `script-src 'unsafe-inline'` is required by Next.js static hydration and the
 *   pre-paint theme-init script. Upgrade path: nonce-based CSP via middleware,
 *   which forces dynamic rendering of every route — deliberately deferred.
 * - `connect-src` allows exactly two origins: ourselves and api.anthropic.com
 *   (for the user's own opt-in API key). The browser refuses every other
 *   cross-origin request even if code regressed — the local-first backstop.
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
  "connect-src 'self' https://api.anthropic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // The Anthropic SDK references node: builtins behind runtime guards; strip
  // the scheme and stub them out of the client bundle (browser build uses
  // fetch, never touches them).
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          },
        ),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        process: false,
        child_process: false,
        net: false,
        tls: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        worker_threads: false,
      };
    }
    return config;
  },
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
