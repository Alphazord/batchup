"use client";

export function LoadingSkeleton({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton rounded-lg"
          style={{
            height: i % 3 === 0 ? "48px" : "44px",
            animationDelay: `${i * 75}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-ridge bg-ink p-5 space-y-3" style={{ animationDelay: `${i * 75}ms` }}>
          <div className="skeleton h-3 w-20 rounded" style={{ animationDelay: `${i * 75}ms` }} />
          <div className="skeleton h-7 w-24 rounded" style={{ animationDelay: `${i * 75 + 50}ms` }} />
          <div className="skeleton h-3 w-16 rounded" style={{ animationDelay: `${i * 75 + 100}ms` }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-3 pb-2 border-b border-ridge">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-3 flex-1 rounded" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2" style={{ animationDelay: `${i * 75}ms` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${(i * cols + j) * 50}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
