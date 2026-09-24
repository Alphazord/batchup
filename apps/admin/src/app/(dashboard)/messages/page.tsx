"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "@/lib/api";
import { formatDateTime, truncate } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import type { Message, MessageSearchResponse } from "@/types";

export default function MessagesPage() {
  const [data, setData] = useState<MessageSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [textQuery, setTextQuery] = useState("");
  const [conversationId, setConversationId] = useState("");

  const fetchMessages = useCallback(async () => {
    if (!textQuery && !conversationId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (textQuery) params.set("q", textQuery);
      if (conversationId) params.set("conversationId", conversationId);
      const result = await adminFetch<MessageSearchResponse>(`/api/admin/messages?${params}`);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to search messages");
    } finally {
      setLoading(false);
    }
  }, [page, textQuery, conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const columns = [
    {
      key: "content",
      header: "Message",
      render: (m: Message) => (
        <div className="max-w-sm">
          <div className="text-paper text-sm">{truncate(m.content, 80)}</div>
        </div>
      ),
    },
    {
      key: "senderId",
      header: "Sender",
      render: (m: Message) => (
        <div className="flex items-center gap-2">
          {m.senderPicture ? (
            <img src={m.senderPicture} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-ridge" referrerPolicy="no-referrer" />
          ) : null}
          <span className="text-dim text-xs truncate">{m.senderName || m.senderId.slice(0, 8)}</span>
        </div>
      ),
    },
    {
      key: "conversationId",
      header: "Conversation",
      render: (m: Message) => <span className="font-mono text-[11px] text-faint">{truncate(m.conversationId, 10)}</span>,
    },
    {
      key: "createdAt",
      header: "Time",
      render: (m: Message) => <span className="text-xs tabular-nums">{formatDateTime(m.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-paper tracking-tight">Messages</h1>
        <p className="text-dim text-sm mt-1">Search messages across all shards</p>
      </div>

      <div className="rounded-lg border border-cobalt/20 bg-cobalt/5 p-3 text-xs text-dim">
        <span className="font-medium text-cobalt">Fan-out search</span> — Your query is broadcast to all 7 shards in parallel. Results are aggregated here.
      </div>

      {error && (
        <div className="rounded-lg border border-marker/30 bg-marker/5 p-3 text-sm text-marker">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <SearchInput onSearch={(q) => { setTextQuery(q); setPage(1); }} placeholder="Search message content..." />
        </div>
        <input
          type="text"
          value={conversationId}
          onChange={(e) => setConversationId(e.target.value)}
          placeholder="Conversation ID (optional)"
          className="px-3 py-2.5 rounded-lg bg-ink border border-ridge text-paper text-sm font-mono placeholder:text-faint focus:outline-none focus:border-cobalt focus:ring-1 focus:ring-cobalt/30 w-full sm:w-64 transition-all"
        />
      </div>

      {data?.source && (
        <div className="flex items-center gap-3 text-xs text-faint">
          <span>Source: <span className="text-dim font-medium">{data.source}</span></span>
          <span>·</span>
          <span>{data.total.toLocaleString()} results</span>
          {data.errors && data.errors.length > 0 && (
            <>
              <span>·</span>
              <span className="text-marker">{data.errors.length} shard(s) unreachable</span>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border border-ridge bg-ink p-4">
        <DataTable
          columns={columns}
          data={data?.messages || []}
          page={page}
          limit={50}
          total={data?.total || 0}
          onPageChange={setPage}
          loading={loading}
          emptyMessage={textQuery || conversationId ? "No messages found" : "Enter a search query to find messages"}
          emptyIcon={<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
        />
      </div>
    </div>
  );
}
