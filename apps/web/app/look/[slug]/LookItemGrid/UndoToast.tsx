import * as React from "react";

interface UndoToastProps {
  visible: boolean;
  onUndo: () => void;
}

export function UndoToast({ visible, onUndo }: UndoToastProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3 transition-all duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <span className="text-sm text-muted-foreground">Swapped item updated.</span>
      <button
        type="button"
        onClick={onUndo}
        className="text-sm font-bold text-foreground underline underline-offset-2 hover:text-foreground/80"
      >
        Undo
      </button>
    </div>
  );
}
