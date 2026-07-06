"use client";

import { Dialog } from "@/components/ui/Dialog";
import { TemplateGallery } from "@/components/onboarding/TemplateGallery";
import { useUIStore } from "@/lib/store/uiStore";
import { applyTemplate } from "@/lib/workspaceOps";

export function TemplatePickerDialog() {
  const open = useUIStore((s) => s.templatePickerOpen);
  const persona = useUIStore((s) => s.onboarding.persona);
  const close = () => useUIStore.getState().setTemplatePickerOpen(false);

  return (
    <Dialog
      open={open}
      onClose={close}
      ariaLabel="Templates"
      className="w-[680px] max-w-[calc(100vw-32px)]"
    >
      <div className="p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Start from a wired board
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--ink-dim)]">
          Templates come pre-linked, so the compile loop clicks immediately.
        </p>
        <div className="mt-4">
          <TemplateGallery
            persona={persona}
            onPick={(id) => {
              applyTemplate(id);
              close();
            }}
          />
        </div>
      </div>
    </Dialog>
  );
}
