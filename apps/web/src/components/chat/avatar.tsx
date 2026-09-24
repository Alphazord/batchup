"use client";

import { useState } from "react";

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-[76px] h-[76px] text-[26px]",
} as const;

const DOT_CLASSES = {
  sm: "w-2.5 h-2.5 border-2",
  md: "w-3 h-3 border-2",
  lg: "w-3.5 h-3.5 border-[3px]",
  xl: "w-[11px] h-[11px] border-[2px]",
} as const;

function getInitials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  name,
  picture,
  size = "md",
  online,
}: {
  name: string;
  picture: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const showImage = picture && !imgError;
  const initials = getInitials(name);

  return (
    <div className="relative inline-flex shrink-0">
      {showImage ? (
        <img
          src={picture}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-cobalt text-white flex items-center justify-center font-semibold select-none`}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-ink-2 ${DOT_CLASSES[size]} ${
            online ? "bg-online" : "bg-paper-faint"
          }`}
        />
      )}
    </div>
  );
}
