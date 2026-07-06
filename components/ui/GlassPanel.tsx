import type { HTMLAttributes } from "react";

type Variant = "card" | "panel" | "bar";

const VARIANT_CLASSES: Record<Variant, string> = {
  card: "glass-card rounded-xl",
  panel: "glass-strong rounded-xl",
  bar: "glass-strong rounded-lg",
};

export function GlassPanel({
  variant = "panel",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={`${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
