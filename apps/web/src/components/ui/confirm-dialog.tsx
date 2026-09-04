"use client";

import { useState, type ReactNode } from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Button } from "./button";
import { Input } from "./input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<void> | void;
  // Optional "type the name to confirm" gate, for the rare action more
  // severe than this dialog's normal one-click confirm covers (e.g.
  // deleting an entire college and every record ever created under
  // it, not just one entity within an org) — the Confirm button stays
  // disabled until the typed text exactly matches. Every existing
  // caller that doesn't pass this keeps today's exact one-click
  // behavior.
  confirmText?: string;
}

// This codebase's one and only "are you sure" modal — used both for
// irreversible deletes (an Institution, a Role) and for actions whose
// real blast radius isn't obvious from the button alone (a bulk
// invoice run, a broadcast Send, a payroll run for the whole staff).
// Built on @base-ui/react's alert-dialog, already a dependency here
// (dropdown-menu.tsx uses the same package's menu module) — this app
// had zero confirm dialogs before this, so one shared component is
// enough; it is not meant to grow into a general-purpose dialog kit.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  confirmText,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [typedText, setTypedText] = useState("");
  const textGateOpen = !confirmText || typedText === confirmText;

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setTypedText("");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTypedText("");
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="space-y-2">
            <AlertDialogPrimitive.Title className="text-base font-semibold">{title}</AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-muted-foreground text-sm">
              {description}
            </AlertDialogPrimitive.Description>
          </div>
          {confirmText ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Type <span className="font-semibold">{confirmText}</span> to confirm
              </label>
              <Input value={typedText} onChange={(e) => setTypedText(e.target.value)} autoComplete="off" />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={confirming}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              size="sm"
              onClick={handleConfirm}
              disabled={confirming || !textGateOpen}
            >
              {confirming ? "Working…" : confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
