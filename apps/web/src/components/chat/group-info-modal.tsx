"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "@/contexts/chat-context";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/modal";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field-label";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { API_ENDPOINTS } from "@repo/api-endpoints";

export function GroupInfoModal({
  open,
  onClose,
  conversationId,
  initialName,
  initialDescription,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  initialName: string;
  initialDescription: string;
}) {
  const { refreshConversations } = useChat();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [open, initialName, initialDescription]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch(API_ENDPOINTS.chat.conversation(conversationId), {
        method: "PUT",
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      await refreshConversations();
      toast("success", "Group updated");
      onClose();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setSaving(false);
    }
  }, [name, description, conversationId, refreshConversations, toast, onClose]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4 px-5 py-5">
        <h2 className="text-lg font-semibold text-paper font-display">Edit Group</h2>

        <div>
          <FieldLabel>Group Name</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Group name"
            autoComplete="off"
          />
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional group description"
            className="w-full bg-ink border-[2.5px] border-ink-3 rounded-[14px] px-[18px] py-[11px] text-[13.5px] text-paper placeholder-paper-faint focus:outline-none focus:border-highlighter resize-none transition-colors touch-target font-body"
          />
          <div className="text-right text-[11px] text-paper-faint mt-1">
            {description.length}/500
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t-[2.5px] border-ink-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
