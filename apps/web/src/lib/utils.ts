/**
 * Returns true if the user was active within the threshold.
 * Accepts ISO string (from DB) or epoch milliseconds (from presence).
 * Default threshold is 2 minutes.
 */
export function isRecentlyActive(
  lastSeen: string | number | null | undefined,
  thresholdMs = 2 * 60 * 1000,
): boolean {
  if (!lastSeen) return false;
  const ts = typeof lastSeen === "string" ? new Date(lastSeen).getTime() : lastSeen;
  return Date.now() - ts < thresholdMs;
}

/**
 * Format a timestamp for display in conversation lists.
 * Returns "" for null/undefined.
 */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
