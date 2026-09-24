"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "@/lib/api";
import { formatDate, truncate } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import type { User, UserListResponse } from "@/types";

export default function UsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      const result = await adminFetch<UserListResponse>(`/api/admin/users?${params}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns = [
    {
      key: "name",
      header: "User",
      render: (u: User) => (
        <div className="flex items-center gap-2.5">
          {u.picture ? (
            <img src={u.picture} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-ridge" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-panel flex items-center justify-center text-[11px] font-bold text-dim ring-2 ring-ridge">
              {u.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-paper text-sm truncate">{u.name}</div>
            <div className="text-[11px] text-faint truncate">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "username",
      header: "Username",
      render: (u: User) => <span className="text-dim font-mono text-xs">@{u.username}</span>,
    },
    {
      key: "id",
      header: "ID",
      className: "hidden lg:table-cell",
      render: (u: User) => <span className="font-mono text-[11px] text-faint">{truncate(u.id, 12)}</span>,
    },
    { key: "createdAt", header: "Joined", render: (u: User) => <span className="text-xs tabular-nums">{formatDate(u.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-paper tracking-tight">Users</h1>
        <p className="text-dim text-sm mt-1">{data?.total?.toLocaleString() ?? 0} total users</p>
      </div>

      {error && (
        <div className="rounded-lg border border-marker/30 bg-marker/5 p-3 text-sm text-marker">{error}</div>
      )}

      <SearchInput onSearch={(q) => { setSearch(q); setPage(1); }} placeholder="Search by name or email..." />

      <div className="rounded-xl border border-ridge bg-ink p-4">
        <DataTable
          columns={columns}
          data={data?.users || []}
          page={page}
          limit={50}
          total={data?.total || 0}
          onPageChange={setPage}
          loading={loading}
          emptyMessage="No users found"
          emptyIcon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
        />
      </div>
    </div>
  );
}
