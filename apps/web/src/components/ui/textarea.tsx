import { forwardRef, type TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: boolean;
  }
>(({ error, className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`
        w-full bg-ink border-[2.5px] rounded-[14px]
        px-[18px] py-[11px] md:py-[11px]
        text-[13.5px] text-paper placeholder-paper-faint
        font-body resize-none
        transition-colors
        touch-target
        focus:outline-none focus:border-highlighter
        ${error ? "border-signal" : "border-ink-3"}
        ${className}
      `}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
