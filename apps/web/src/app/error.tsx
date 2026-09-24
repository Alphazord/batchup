"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-paper mb-2">Something went wrong</h1>
        <p className="text-paper-dim mb-6">{error.message || "Please try again later."}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium text-paper bg-cobalt rounded-full hover:bg-cobalt-hover transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
