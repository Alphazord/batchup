"use client";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center bg-ink p-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-ink-3 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-signal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-[17px] font-semibold text-paper mb-1 font-display">
          Chat unavailable
        </h2>
        <p className="text-[13.5px] text-paper-dim mb-5">
          {error.message || "Something went wrong while loading the chat."}
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2 text-[13px] font-semibold text-ink bg-highlighter rounded-full hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
