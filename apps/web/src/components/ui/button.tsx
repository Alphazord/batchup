import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-highlighter text-ink border-transparent hover:bg-highlighter-dim",
  secondary: "bg-cobalt text-white border-transparent hover:bg-cobalt-hover",
  ghost: "bg-transparent text-paper border-ink-3 hover:bg-ink-3",
  danger: "bg-transparent text-signal border-signal hover:bg-signal/10",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    fullWidth?: boolean;
  }
>(({ variant = "primary", fullWidth, className = "", disabled, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        rounded-full font-body font-bold text-[14px]
        px-[22px] py-[11px] md:py-[11px]
        border-[2.5px] transition-colors
        touch-target
        ${VARIANT_CLASSES[variant]}
        ${fullWidth ? "w-full" : ""}
        touch-active
        ${disabled ? "bg-ink-3 text-paper-faint border-transparent cursor-not-allowed opacity-100" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";
