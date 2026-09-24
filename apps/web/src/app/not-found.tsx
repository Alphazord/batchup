import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-ink">
      <h1 className="text-6xl font-bold text-paper mb-4">404</h1>
      <p className="text-lg text-paper-dim mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 text-sm font-semibold text-paper bg-cobalt rounded-full hover:bg-cobalt-hover transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
