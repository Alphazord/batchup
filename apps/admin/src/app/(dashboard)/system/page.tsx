"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { CardSkeleton } from "@/components/loading-skeleton";
import type { SystemHealth } from "@/types";

export default function SystemPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<SystemHealth>("/api/admin/system")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeleton />;
  if (error) return <div className="text-marker text-sm p-8">{error}</div>;
  if (!data) return null;

  const maxCount = Math.max(...data.shardDistribution.map((r) => r.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-paper tracking-tight">System Health</h1>
        <p className="text-dim text-sm mt-1">Infrastructure status and connectivity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-stagger">
        <StatCard
          title="Database"
          value={data.database.status}
          subtitle={`${data.database.latency}ms latency`}
          accent={data.database.status === "ok" ? "online" : "marker"}
        />
        <StatCard
          title="Active Sessions"
          value={formatNumber(data.activeSessions)}
          accent="cobalt"
        />
        <StatCard
          title="Shards Online"
          value={`${data.shardDistribution.length}/8`}
          subtitle={`${data.shardDistribution.length - 1} shards + Account 1`}
          accent="online"
        />
      </div>

      <div className="rounded-xl border border-ridge bg-ink p-5">
        <h3 className="text-[11px] font-semibold text-faint uppercase tracking-wider mb-4">Shard Distribution</h3>
        <div className="space-y-3">
          {data.shardDistribution.map((row) => {
            const pct = Math.round((row.count / maxCount) * 100);
            const isAccount1 = row.shard_id === 0;
            const barGradient = isAccount1
              ? "from-cobalt to-cobalt"
              : `from-online/70 to-cobalt`;

            return (
              <div key={row.shard_id} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={isAccount1 ? "Account 1" : `Shard ${row.shard_id}`} />
                  </div>
                  <span className="text-sm text-paper font-mono tabular-nums">{formatNumber(row.count)}</span>
                </div>
                <div className="h-2 bg-panel rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
