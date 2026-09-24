import type { LabelHTMLAttributes } from "react";

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className="block font-mono text-[10.5px] uppercase text-paper-dim tracking-[0.05em] mb-[6px]"
      {...props}
    />
  );
}
