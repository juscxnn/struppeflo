import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Struppëflo — Think in space. Ship in structure.",
  description:
    "A glass-morphism thinking canvas that compiles your spatial arrangement of ideas into structured, dependency-ordered context for LLMs. Local-first, no account needed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#07090f" },
  ],
};

/**
 * Pre-paint theme init. Static string constant — never interpolated with user
 * data (CSP: the one sanctioned inline script).
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("struppeflo-theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AuroraBackground />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
