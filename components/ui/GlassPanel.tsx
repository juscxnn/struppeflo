import type { HTMLAttributes } from "react";

type Variant = "card" | "panel" | "bar";

const VARIANT_CLASSES: Record<Variant, string> = {
  // Cards get backdrop-filter (the perf-managed class); panels/bars are the
  // stronger chrome surfaces that always blur (there are only ever a few).
  card: "glass-card rounded-2xl",
  panel: "glass-strong glass-blur rounded-[20px]",
  bar: "glass-strong glass-blur rounded-full",
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
