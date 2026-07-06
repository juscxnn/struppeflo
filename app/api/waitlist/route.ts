import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email().max(200),
  source: z.string().max(40).optional(),
});

/**
 * Pro waitlist capture. Always logs (visible in Vercel function logs); set
 * WAITLIST_WEBHOOK_URL (Zapier / Make / Apps Script / Formspree endpoint)
 * to durably store signups — the forward happens server-side, so the
 * client CSP is untouched.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }

  console.log(
    `[waitlist] ${parsed.email} (${parsed.source ?? "unknown"}) at ${new Date().toISOString()}`,
  );

  const webhook = process.env.WAITLIST_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: parsed.email,
          source: parsed.source ?? "unknown",
          at: new Date().toISOString(),
        }),
      });
    } catch {
      // Log-only fallback; never surface storage problems to the visitor.
    }
  }

  return NextResponse.json({ ok: true });
}
