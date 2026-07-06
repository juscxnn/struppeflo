"use client";

/**
 * Copy with fallback: the async Clipboard API needs a secure context and
 * permission; the legacy textarea + execCommand path works nearly everywhere
 * else. Copying the compiled prompt is the product's core action — it must
 * not fail quietly.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    // The permission prompt can leave this promise pending forever in
    // embedded/headless contexts — race it so the fallback still runs.
    const ok = await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<false>((r) => setTimeout(() => r(false), 800)),
    ]);
    if (ok) return true;
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
