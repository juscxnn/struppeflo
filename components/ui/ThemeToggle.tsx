"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

export function ThemeToggle() {
  // null until mounted — avoids hydration mismatch with the pre-paint script.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("struppeflo-theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode) — theme still applies for the session.
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg
        text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]
        transition-colors"
    >
      {dark === null ? (
        <span className="w-4 h-4" />
      ) : dark ? (
        <SunIcon size={17} />
      ) : (
        <MoonIcon size={17} />
      )}
    </button>
  );
}
