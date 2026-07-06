import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Struppëflo — Think in space. Ship in structure.",
  description:
    "A thinking canvas that compiles your spatial arrangement of ideas into structured, dependency-ordered context for LLMs. Local-first, no account needed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
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
