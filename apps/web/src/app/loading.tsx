export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-cobalt border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-paper-dim text-sm">Loading...</p>
      </div>
    </div>
  );
}
