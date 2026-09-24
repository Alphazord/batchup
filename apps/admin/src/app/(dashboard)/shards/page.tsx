"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { CardSkeleton } from "@/components/loading-skeleton";
import type { ShardHealth, ShardHealthResponse } from "@/types";

export default function ShardsPage() {
  const [data, setData] = useState<ShardHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    function fetchShards() {
      adminFetch<ShardHealthResponse>("/api/admin/shards")
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }

    fetchShards();
    interval = setInterval(fetchShards, 30_000);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton count={8} />;
  if (error) return <div className="text-marker text-sm p-8">{error}</div>;
  if (!data) return null;

  const allHealthy = data.shards.every((s) => s.status === "ok");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper tracking-tight">Shards</h1>
          <p className="text-dim text-sm mt-1">Auto-refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink border border-ridge">
          <span
            className="h-2 w-2 rounded-full bg-online"
            style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
          />
          <span className="text-xs font-medium text-dim">
            {allHealthy ? "All Systems Operational" : "Degraded"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-ridge bg-ink p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-semibold text-faint uppercase tracking-wider">Account 1 (Non-Sharded)</h3>
            <p className="text-paper text-sm mt-1 tabular-nums">{data.acct1ConversationCount.toLocaleString()} conversations</p>
          </div>
          <StatusBadge status="ok" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-stagger">
        {data.shards.map((shard) => (
          <ShardCard key={shard.id} shard={shard} />
        ))}
      </div>
    </div>
  );
}

function ShardCard({ shard }: { shard: ShardHealth }) {
  const doBudgetPct = shard.circuitBreaker
    ? Math.min(100, Math.round((shard.circuitBreaker.doRequestCount / 90_000) * 100))
    : 0;

  const budgetColor = doBudgetPct > 80 ? "bg-marker" : doBudgetPct > 50 ? "bg-highlighter" : "bg-online";

  return (
    <div className="rounded-xl border border-ridge bg-ink p-5 transition-all duration-200 hover:border-cobalt/30">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-paper">{shard.name}</h3>
          <p className="text-[11px] text-faint font-mono">Shard {shard.id}</p>
        </div>
        <StatusBadge status={shard.status} />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-dim">Latency</span>
          <span className="text-paper font-mono tabular-nums">{shard.latency}ms</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-dim">Conversations</span>
          <span className="text-paper font-mono tabular-nums">{shard.conversationCount.toLocaleString()}</span>
        </div>

        {shard.d1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-dim">D1</span>
            <span className={`font-mono text-xs ${shard.d1.status === "connected" ? "text-online" : "text-marker"}`}>
              {shard.d1.status} ({shard.d1.latency}ms)
            </span>
          </div>
        )}

        {shard.redis && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-dim">Redis</span>
            <span className={`font-mono text-xs ${shard.redis.status === "connected" ? "text-online" : "text-marker"}`}>
              {shard.redis.status} ({shard.redis.latency}ms)
            </span>
          </div>
        )}

        {shard.circuitBreaker && (
          <div className="pt-2 border-t border-ridge/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-dim">DO Budget</span>
              <span className="text-paper font-mono tabular-nums">
                {shard.circuitBreaker.doRequestCount.toLocaleString()} / 90K
              </span>
            </div>
            <div className="h-1.5 bg-panel rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${budgetColor}`}
                style={{ width: `${doBudgetPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
