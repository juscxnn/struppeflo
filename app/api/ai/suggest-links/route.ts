import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ board: z.unknown() });

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body: expected JSON { board }" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      error:
        "AI backend not configured — v1 runs fully local (lib/ai/mockProvider.ts). Implement with the Anthropic API and set NEXT_PUBLIC_AI_PROVIDER=api.",
    },
    { status: 501 },
  );
}
