import { NextResponse } from "next/server";

/**
 * Shared bearer-token check used by every /api/admin/* route. Returns null
 * when the request is authorized, or a 401 NextResponse when it isn't.
 *
 * Lives outside of any individual route.ts because Next.js only allows
 * the handler methods (GET / POST / etc.) to be exported from route files —
 * a named export like `requireAdmin` would be silently stripped at build
 * time, or flagged by the type-checker. The `_lib` directory is excluded
 * from the route discovery by Next's convention (folders prefixed with
 * `_`).
 */
export function requireAdmin(req: Request): NextResponse | null {
  const token = process.env.TELEMETRY_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!bearer || bearer !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
