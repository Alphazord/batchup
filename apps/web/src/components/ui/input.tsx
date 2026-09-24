import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
  }
>(({ error, className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`
        w-full bg-ink border-[2.5px] rounded-full
        px-[18px] py-[11px] md:py-[11px]
        text-[13.5px] text-paper placeholder-paper-faint
        font-body
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

Input.displayName = "Input";
