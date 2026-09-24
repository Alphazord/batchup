"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingProgrammatically = useRef(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) {
        closingProgrammatically.current = true;
        el.close();
      }
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        if (closingProgrammatically.current) {
          closingProgrammatically.current = false;
          return;
        }
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`
        fixed bg-ink border-[2.5px] border-ink-3
        w-full
        animate-scale-in
        bottom-0 left-0 right-0
        max-h-[85dvh]
        rounded-t-[22px]
        md:animate-scale-in
        md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
        md:rounded-[22px] md:shadow-[0_40px_90px_rgba(0,0,0,.5)]
        md:max-h-[85dvh]
        ${wide ? "md:max-w-lg" : "md:max-w-[380px]"}
      `}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Mobile drag handle */}
      <div className="md:hidden flex justify-center pt-[10px] pb-[6px]">
        <div className="w-10 h-[4px] rounded-full bg-ink-3" />
      </div>
      <div className="overflow-y-auto max-h-[calc(85dvh-30px)] md:max-h-[calc(85dvh-30px)]">
        {children}
      </div>
    </dialog>
  );
}
