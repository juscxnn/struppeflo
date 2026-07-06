import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "glass";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary font-semibold",
  ghost:
    "text-[var(--ink)] hover:bg-[var(--accent-soft)] active:bg-[var(--accent-soft)]",
  danger:
    "text-[var(--danger)] hover:bg-[rgba(229,72,77,0.1)]",
  glass:
    "text-[var(--ink)] glass-strong glass-blur hover:brightness-105 active:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1 rounded-lg",
  md: "h-9 px-3.5 text-[13.5px] gap-1.5 rounded-[10px]",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
};

export function Button({
  variant = "ghost",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={
        "inline-flex items-center justify-center font-medium select-none " +
        "transition-[background,filter,transform] duration-150 " +
        "disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap " +
        `${VARIANTS[variant]} ${SIZES[size]} ${className}`
      }
      {...props}
    />
  );
}
