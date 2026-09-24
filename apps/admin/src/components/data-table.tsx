"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Column<T = any> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
}

export function DataTable({
  columns,
  data,
  page,
  limit,
  total,
  onPageChange,
  loading,
  emptyMessage = "No data found",
  emptyIcon,
  onRowClick,
}: DataTableProps) {
  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 skeleton rounded-lg" style={{ animationDelay: `${i * 75}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ridge">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-2.5 px-3 text-[11px] text-faint uppercase font-semibold tracking-wider ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center">
                {emptyIcon && <div className="flex justify-center mb-3 text-ridge">{emptyIcon}</div>}
                <p className="text-faint text-sm">{emptyMessage}</p>
              </td>
            </tr>
          ) : (
            data.map((item, i) => (
              <tr
                key={i}
                className={`border-b border-ridge/50 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-panel/50" : "hover:bg-panel/30"
                }`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-2.5 px-3 text-dim ${col.className || ""}`}>
                    {col.render ? col.render(item) : String(item[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-ridge">
          <p className="text-xs text-faint tabular-nums">
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-panel text-dim hover:bg-ridge hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Prev
            </button>
            <span className="px-2 text-xs text-faint tabular-nums">
              {page}/{totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-panel text-dim hover:bg-ridge hover:text-paper disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
