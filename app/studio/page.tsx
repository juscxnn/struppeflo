import type { Metadata } from "next";
import { StudioShell } from "@/components/StudioShell";

export const metadata: Metadata = {
  title: "Studio — Struppëflo",
};

export default function StudioPage() {
  return <StudioShell />;
}
