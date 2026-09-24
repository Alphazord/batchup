const STATUS_STYLES: Record<string, { classes: string; dotColor: string }> = {
  ok: { classes: "bg-online/10 text-online border-online/20", dotColor: "bg-online" },
  connected: { classes: "bg-online/10 text-online border-online/20", dotColor: "bg-online" },
  paid: { classes: "bg-online/10 text-online border-online/20", dotColor: "bg-online" },
  degraded: { classes: "bg-highlighter/10 text-highlighter border-highlighter/20", dotColor: "bg-highlighter" },
  pending: { classes: "bg-highlighter/10 text-highlighter border-highlighter/20", dotColor: "bg-highlighter" },
  error: { classes: "bg-marker/10 text-marker border-marker/20", dotColor: "bg-marker" },
  failed: { classes: "bg-marker/10 text-marker border-marker/20", dotColor: "bg-marker" },
  unreachable: { classes: "bg-marker/10 text-marker border-marker/20", dotColor: "bg-marker" },
  dm: { classes: "bg-cobalt/10 text-cobalt border-cobalt/20", dotColor: "bg-cobalt" },
  group: { classes: "bg-marker/10 text-marker border-marker/20", dotColor: "bg-marker" },
  owner: { classes: "bg-highlighter/10 text-highlighter border-highlighter/20", dotColor: "bg-highlighter" },
  admin: { classes: "bg-cobalt/10 text-cobalt border-cobalt/20", dotColor: "bg-cobalt" },
  member: { classes: "bg-panel text-dim border-ridge", dotColor: "bg-faint" },
};

export function StatusBadge({ status }: { status: string }) {
  const { classes, dotColor } = STATUS_STYLES[status] || { classes: "bg-panel text-dim border-ridge", dotColor: "bg-faint" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {status}
    </span>
  );
}
