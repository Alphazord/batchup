"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "@/lib/api";
import { formatDate, truncate } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import type { Conversation, ConversationListResponse } from "@/types";

export default function ConversationsPage() {
  const [data, setData] = useState<ConversationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [shardFilter, setShardFilter] = useState("");

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (shardFilter) params.set("shard", shardFilter);
      const result = await adminFetch<ConversationListResponse>(`/api/admin/conversations?${params}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, shardFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const columns = [
    {
      key: "name",
      header: "Conversation",
      render: (c: Conversation) => (
        <div className="min-w-0">
          <div className="font-medium text-paper text-sm truncate">{c.name || truncate(c.id, 20)}</div>
          {c.lastMessagePreview && (
            <div className="text-[11px] text-faint mt-0.5 truncate">{truncate(c.lastMessagePreview, 50)}</div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (c: Conversation) => <StatusBadge status={c.type} />,
    },
    {
      key: "memberCount",
      header: "Members",
      render: (c: Conversation) => <span className="tabular-nums">{c.memberCount}</span>,
    },
    {
      key: "shardId",
      header: "Shard",
      render: (c: Conversation) => (
        <span className="font-mono text-xs text-faint">
          {c.shardId === 0 ? "Acct 1" : `S${c.shardId}`}
        </span>
      ),
    },
    {
      key: "lastMessageAt",
      header: "Last Active",
      render: (c: Conversation) => <span className="text-xs tabular-nums">{formatDate(c.lastMessageAt)}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      className: "hidden lg:table-cell",
      render: (c: Conversation) => <span className="text-xs tabular-nums">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-paper tracking-tight">Conversations</h1>
        <p className="text-dim text-sm mt-1">{data?.total?.toLocaleString() ?? 0} total conversations</p>
      </div>

      {error && (
        <div className="rounded-lg border border-marker/30 bg-marker/5 p-3 text-sm text-marker">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <SearchInput onSearch={(q) => { setSearch(q); setPage(1); }} placeholder="Search conversations..." />
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="select px-3 py-2.5 rounded-lg bg-ink border border-ridge text-paper text-sm focus:outline-none focus:border-cobalt cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="dm">DM</option>
            <option value="group">Group</option>
          </select>
          <select
            value={shardFilter}
            onChange={(e) => { setShardFilter(e.target.value); setPage(1); }}
            className="select px-3 py-2.5 rounded-lg bg-ink border border-ridge text-paper text-sm focus:outline-none focus:border-cobalt cursor-pointer"
          >
            <option value="">All Shards</option>
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Account 1" : `Shard ${i}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-ridge bg-ink p-4">
        <DataTable
          columns={columns}
          data={data?.conversations || []}
          page={page}
          limit={50}
          total={data?.total || 0}
          onPageChange={setPage}
          loading={loading}
          emptyMessage="No conversations found"
          emptyIcon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
        />
      </div>
    </div>
  );
}
