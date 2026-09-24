"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "@/contexts/chat-context";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { API_ENDPOINTS } from "@repo/api-endpoints";
import { RATE_LIMIT_TIERS, type RateLimitTier } from "@repo/types";

export function RateLimitSettingsModal({
  open,
  onClose,
  conversationId,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
}) {
  const { refreshConversations } = useChat();
  const { toast } = useToast();
  const [tier, setTier] = useState<RateLimitTier>("normal");
  const [perMinute, setPerMinute] = useState(40);
  const [perSecond, setPerSecond] = useState(5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<{ rateLimit: { rateLimitTier: string; rateLimitPerMinute: number; rateLimitPerSecond: number } }>(
      API_ENDPOINTS.chat.rateLimit(conversationId),
    )
      .then((data) => {
        setTier(data.rateLimit.rateLimitTier as RateLimitTier);
        setPerMinute(data.rateLimit.rateLimitPerMinute);
        setPerSecond(data.rateLimit.rateLimitPerSecond);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, conversationId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { tier };
      if (tier === "custom") {
        body.perMinute = perMinute;
        body.perSecond = perSecond;
      }
      await apiFetch(API_ENDPOINTS.chat.rateLimit(conversationId), {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await refreshConversations();
      toast("success", "Rate limit settings updated");
      onClose();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }, [tier, perMinute, perSecond, conversationId, refreshConversations, toast, onClose]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4 px-5 py-5">
        <h2 className="text-lg font-semibold text-paper font-display">Rate Limit Settings</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {Object.entries(RATE_LIMIT_TIERS).map(([key, t]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-[14px] border-[2.5px] cursor-pointer transition-colors ${
                    tier === key
                      ? "border-cobalt bg-cobalt/10"
                      : "border-ink-3 hover:border-paper-dim"
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={key}
                    checked={tier === key}
                    onChange={() => setTier(key as RateLimitTier)}
                    className="accent-cobalt"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-paper">{t.label}</div>
                    <div className="text-xs text-paper-dim">
                      {t.perMinute} msgs/min · {t.perSecond} msgs/sec
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {tier === "custom" && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-ink-3 rounded-[14px]">
                <div>
                  <label className="block font-mono text-[10.5px] font-semibold text-paper-dim uppercase mb-1">
                    Per Minute
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={perMinute}
                    onChange={(e) => setPerMinute(Math.max(1, Math.min(100, Number(e.target.value))))}
                    className="w-full bg-ink border-[2.5px] border-ink-3 rounded-full px-4 py-2.5 text-[13.5px] text-paper focus:outline-none focus:border-highlighter transition-colors touch-target"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10.5px] font-semibold text-paper-dim uppercase mb-1">
                    Per Second
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    inputMode="numeric"
                    value={perSecond}
                    onChange={(e) => setPerSecond(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="w-full bg-ink border-[2.5px] border-ink-3 rounded-full px-4 py-2.5 text-[13.5px] text-paper focus:outline-none focus:border-highlighter transition-colors touch-target"
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t-[2.5px] border-ink-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
