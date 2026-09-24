"use client";

import { BRANDING } from "@/config/branding";

export function Footer() {
  return (
    <footer className="py-8 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 40 40"
              fill="none"
              className="shrink-0"
            >
              <rect width="40" height="40" rx="11" fill="#DFFF4F" />
              <path
                d="M10 16C10 13.79 11.79 12 14 12H22C25.31 12 28 14.69 28 18C28 20.4 26.61 22.47 24.6 23.45L28 27H22.5L20 24H14C11.79 24 10 22.21 10 20V16Z"
                fill="#12132A"
              />
              <path d="M17 27L21 21H26L22 27H17Z" fill="#12132A" />
            </svg>
            <span
              className="text-[var(--paper-dim)] text-sm"
              style={{ fontFamily: "var(--mono)" }}
            >
              {BRANDING.name}
            </span>
          </div>
          <div
            className="flex items-center gap-4 sm:gap-6 text-sm text-[var(--paper-dim)] flex-wrap justify-center"
            style={{ fontFamily: "var(--mono)" }}
          >
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="/security" className="hover:underline">Security</a>
            <a href="/contact" className="hover:underline">Contact</a>
            <span>{BRANDING.url.replace("https://", "")}</span>
          </div>
        </div>
        <span
          className="text-sm text-[var(--paper-dim)]"
          style={{ fontFamily: "var(--mono)" }}
        >
          Founding Batch of 2026
        </span>
        <div
          className="text-xs text-[var(--paper-dim)]"
          style={{ fontFamily: "var(--mono)" }}
        >
          A product by{" "}
          <a
            href={BRANDING.madeByUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--highlighter)] font-bold hover:underline"
          >
            {BRANDING.madeBy}
          </a>
        </div>
      </div>
    </footer>
  );
}
