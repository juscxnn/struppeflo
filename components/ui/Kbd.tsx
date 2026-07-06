export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
        rounded-[5px] text-[11px] font-medium font-sans
        text-[var(--ink-dim)] bg-[var(--glass)] border border-[var(--glass-border)]
        shadow-[0_1px_0_var(--glass-edge)]"
    >
      {children}
    </kbd>
  );
}
