"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";
import { CardSkeleton } from "@/components/loading-skeleton";
import type { DashboardStats } from "@/types";

const DO_BUDGET_LIMIT = 90_000;
const EST_MAX_CONCURRENT_USERS = 10_000;
const EST_MAX_CONVERSATIONS = 5_000_000;
const EST_MAX_MESSAGES_PER_DAY = 1_000_000;

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    adminFetch<DashboardStats>("/api/admin/stats")
      .then((s) => {
        setStats(s);
        setLastRefreshed(new Date());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeleton />;
  if (error) return <div className="text-marker text-sm p-8">{error}</div>;
  if (!stats) return null;

  const sessionUtilization = Math.min(100, Math.round((stats.activeSessions / EST_MAX_CONCURRENT_USERS) * 100));
  const userCapacity = Math.min(100, Math.round((stats.totalUsers / 10_000) * 100));
  const convCapacity = Math.min(100, Math.round((stats.totalConversations / EST_MAX_CONVERSATIONS) * 100));

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper tracking-tight">Overview</h1>
          <p className="text-dim text-sm mt-1">System-wide metrics at a glance</p>
        </div>
        {lastRefreshed && (
          <p className="text-[11px] text-faint tabular-nums">
            Refreshed {lastRefreshed.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
        <StatCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          accent="cobalt"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
        />
        <StatCard
          title="Conversations"
          value={formatNumber(stats.totalConversations)}
          subtitle={`${stats.dmCount} DMs · ${stats.groupCount} groups`}
          accent="online"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
        />
        <StatCard
          title="Messages"
          value={formatNumber(stats.totalMessages)}
          accent="cobalt"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 8h16.5M3.75 12h16.5m-16.5 4h16.5" /></svg>}
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(stats.totalRevenue)}
          subtitle={`${stats.paidOrders} paid / ${stats.totalOrders} total`}
          accent="highlighter"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
        />
      </div>

      {/* System Capacity */}
      <div>
        <h2 className="font-display text-sm font-semibold text-faint uppercase tracking-wider mb-3">System Capacity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CapacityCard
            label="Concurrent Sessions"
            current={stats.activeSessions}
            max={EST_MAX_CONCURRENT_USERS}
            unit="users"
            color="online"
          />
          <CapacityCard
            label="User Base"
            current={stats.totalUsers}
            max={10_000}
            unit="users"
            color="cobalt"
          />
          <CapacityCard
            label="Conversations"
            current={stats.totalConversations}
            max={EST_MAX_CONVERSATIONS}
            unit="convos"
            color="highlighter"
          />
          <CapacityCard
            label="Messages Stored"
            current={stats.totalMessages}
            max={50_000_000}
            unit="msgs"
            color="marker"
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-ridge bg-ink p-4">
          <p className="text-[11px] text-faint uppercase font-semibold tracking-wider">Active Sessions</p>
          <p className="text-xl font-display font-bold text-paper mt-1 tabular-nums">{formatNumber(stats.activeSessions)}</p>
          <p className="text-xs text-dim mt-1">of ~{formatNumber(EST_MAX_CONCURRENT_USERS)} capacity</p>
        </div>
        <div className="rounded-xl border border-ridge bg-ink p-4">
          <p className="text-[11px] text-faint uppercase font-semibold tracking-wider">Conversion Rate</p>
          <p className="text-xl font-display font-bold text-paper mt-1 tabular-nums">
            {stats.totalOrders > 0 ? Math.round((stats.paidOrders / stats.totalOrders) * 100) : 0}%
          </p>
          <p className="text-xs text-dim mt-1">{stats.paidOrders} of {stats.totalOrders} orders paid</p>
        </div>
        <div className="rounded-xl border border-ridge bg-ink p-4">
          <p className="text-[11px] text-faint uppercase font-semibold tracking-wider">Avg Revenue/Order</p>
          <p className="text-xl font-display font-bold text-paper mt-1 tabular-nums">
            {stats.paidOrders > 0 ? formatCurrency(Math.round(stats.totalRevenue / stats.paidOrders)) : "—"}
          </p>
          <p className="text-xs text-dim mt-1">across all paid orders</p>
        </div>
      </div>
    </div>
  );
}

function CapacityCard({ label, current, max, unit, color }: { label: string; current: number; max: number; unit: string; color: string }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  const remaining = Math.max(0, max - current);

  const barColors: Record<string, string> = {
    online: "bg-online",
    cobalt: "bg-cobalt",
    highlighter: "bg-highlighter",
    marker: "bg-marker",
  };

  return (
    <div className="rounded-xl border border-ridge bg-ink p-4">
      <p className="text-[11px] text-faint uppercase font-semibold tracking-wider">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className="text-xl font-display font-bold text-paper tabular-nums">{formatNumber(current)}</span>
        <span className="text-xs text-faint">/ {formatNumber(max)}</span>
      </div>
      <div className="mt-2.5 h-1.5 bg-panel rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color] || "bg-cobalt"}`}
          style={{ width: `${pct}%`, opacity: pct > 80 ? 1 : 0.7 }}
        />
      </div>
      <p className="text-[11px] text-faint mt-1.5">
        {pct}% used · {formatNumber(remaining)} {unit} remaining
      </p>
    </div>
  );
}
