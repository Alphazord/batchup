"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { CardSkeleton } from "@/components/loading-skeleton";
import type { Order, OrderListResponse, OrderStats } from "@/types";

export default function OrdersPage() {
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const result = await adminFetch<OrderListResponse>(`/api/admin/orders?${params}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    adminFetch<OrderStats>("/api/admin/orders/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const columns = [
    {
      key: "productName",
      header: "Product",
      render: (o: Order) => <span className="font-medium text-paper text-sm">{o.productName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      render: (o: Order) => <span className="tabular-nums font-mono text-sm">{formatCurrency(o.amount)}</span>,
    },
    { key: "status", header: "Status", render: (o: Order) => <StatusBadge status={o.status} /> },
    { key: "customerName", header: "Customer", render: (o: Order) => <span className="text-sm">{o.customerName || "—"}</span> },
    { key: "customerEmail", header: "Email", className: "hidden lg:table-cell", render: (o: Order) => <span className="text-xs text-faint">{o.customerEmail || "—"}</span> },
    { key: "createdAt", header: "Date", render: (o: Order) => <span className="text-xs tabular-nums">{formatDate(o.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-paper tracking-tight">Orders</h1>
        <p className="text-dim text-sm mt-1">{data?.total?.toLocaleString() ?? 0} total orders</p>
      </div>

      {error && (
        <div className="rounded-lg border border-marker/30 bg-marker/5 p-3 text-sm text-marker">{error}</div>
      )}

      {statsLoading ? (
        <CardSkeleton count={4} />
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
          <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} accent="cobalt" />
          <StatCard title="Paid" value={stats.paidCount} accent="online" />
          <StatCard title="Pending" value={stats.pendingCount} accent="highlighter" />
          <StatCard title="Failed" value={stats.failedCount} accent="marker" />
        </div>
      ) : null}

      {stats && stats.byProduct.length > 0 && (
        <div className="rounded-xl border border-ridge bg-ink p-5">
          <h3 className="text-[11px] font-semibold text-faint uppercase tracking-wider mb-3">Revenue by Product</h3>
          <div className="space-y-2.5">
            {stats.byProduct.map((p) => (
              <div key={p.product_id} className="flex items-center justify-between">
                <span className="text-sm text-paper">{p.product_name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-faint tabular-nums">{p.order_count} orders</span>
                  <span className="text-sm font-semibold text-paper tabular-nums">{formatCurrency(p.total_revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <SearchInput onSearch={(q) => { setSearch(q); setPage(1); }} placeholder="Search orders..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="select px-3 py-2.5 rounded-lg bg-ink border border-ridge text-paper text-sm focus:outline-none focus:border-cobalt cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="rounded-xl border border-ridge bg-ink p-4">
        <DataTable
          columns={columns}
          data={data?.orders || []}
          page={page}
          limit={50}
          total={data?.total || 0}
          onPageChange={setPage}
          loading={loading}
          emptyMessage="No orders found"
          emptyIcon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
        />
      </div>
    </div>
  );
}
