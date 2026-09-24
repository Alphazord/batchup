"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useChat } from "@/contexts/chat-context";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { EmptyState } from "./empty-state";
import { RateLimitSettingsModal } from "./rate-limit-settings";
import { Modal } from "@/components/modal";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function ChatWindow({
  onMenuToggle,
  onMembersToggle,
  membersOpen,
  onStartChat,
  onOpenCreateGroup,
}: {
  onMenuToggle: () => void;
  onMembersToggle: () => void;
  membersOpen: boolean;
  onStartChat: () => void;
  onOpenCreateGroup: () => void;
}) {
  const { activeConversationId, editMessage, deleteMessage, messages, members } = useChat();

  // Memoize message/member lookups to avoid O(n) .find() on every render
  const messageMap = useMemo(() => {
    const map = new Map<string, (typeof messages)[0]>();
    for (const m of messages) {
      map.set(m.id, m);
    }
    return map;
  }, [messages]);

  const memberMap = useMemo(() => {
    const map = new Map<string, (typeof members)[0]>();
    for (const m of members) {
      map.set(m.userId, m);
    }
    return map;
  }, [members]);
  const [editModal, setEditModal] = useState<{ open: boolean; messageId: string; content: string; createdAt: string }>({
    open: false,
    messageId: "",
    content: "",
    createdAt: "",
  });
  const [replyTo, setReplyTo] = useState<{ messageId: string; senderName: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showRateLimitSettings, setShowRateLimitSettings] = useState(false);
  const [editTimeRemaining, setEditTimeRemaining] = useState<number | null>(null);
  const editTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit countdown timer
  useEffect(() => {
    if (editModal.open && editModal.createdAt) {
      const updateRemaining = () => {
        const elapsed = Date.now() - new Date(editModal.createdAt).getTime();
        const remaining = EDIT_WINDOW_MS - elapsed;
        if (remaining <= 0) {
          setEditModal({ open: false, messageId: "", content: "", createdAt: "" });
          setEditTimeRemaining(null);
          if (editTimerRef.current) clearInterval(editTimerRef.current);
          return;
        }
        setEditTimeRemaining(remaining);
      };
      updateRemaining();
      editTimerRef.current = setInterval(updateRemaining, 1000);
      return () => {
        if (editTimerRef.current) clearInterval(editTimerRef.current);
      };
    }
    setEditTimeRemaining(null);
    return undefined;
  }, [editModal.open, editModal.createdAt]);

  const handleEdit = useCallback((messageId: string, content: string) => {
    const msg = messageMap.get(messageId);
    if (!msg) return;
    setEditModal({ open: true, messageId, content, createdAt: msg.createdAt });
    setEditContent(content);
  }, [messageMap]);

  const handleEditSave = useCallback(() => {
    if (editContent.trim()) {
      editMessage(editModal.messageId, editContent.trim());
    }
    setEditModal({ open: false, messageId: "", content: "", createdAt: "" });
  }, [editContent, editModal.messageId, editMessage]);

  const handleDelete = useCallback((messageId: string) => {
    deleteMessage(messageId);
  }, [deleteMessage]);

  const handleReply = useCallback((messageId: string) => {
    const msg = messageMap.get(messageId);
    if (!msg) return;
    const member = memberMap.get(msg.senderId);
    setReplyTo({
      messageId,
      senderName: member?.name ?? "Unknown",
      content: msg.content,
    });
  }, [messageMap, memberMap]);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (!activeConversationId) {
    return <EmptyState onStartChat={onStartChat} onOpenCreateGroup={onOpenCreateGroup} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-ink min-h-0">
      <ChatHeader
        showMembers={membersOpen}
        onToggleMembers={onMembersToggle}
        onBack={onMenuToggle}
        onRateLimitSettings={() => setShowRateLimitSettings(true)}
      />
      <MessageList
        onEditMessage={handleEdit}
        onDeleteMessage={handleDelete}
        onReplyMessage={handleReply}
      />
      <MessageInput
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
      />

      {/* Edit Modal */}
      <Modal open={editModal.open} onClose={() => setEditModal({ ...editModal, open: false })}>
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-paper font-display">Edit Message</h2>
            {editTimeRemaining !== null && (
              <span className={`text-xs ${editTimeRemaining < 60000 ? "text-marker" : "text-paper-dim"}`}>
                {formatTimeRemaining(editTimeRemaining)} remaining
              </span>
            )}
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-ink-2 border border-ink-3 rounded-lg px-3 py-2.5 md:py-2 text-sm text-paper placeholder-paper-dim focus:outline-none focus:border-paper-dim resize-none transition-colors touch-target"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditModal({ ...editModal, open: false })}
              className="px-4 py-2.5 md:py-2 text-sm text-paper-dim hover:text-paper transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              disabled={!editContent.trim()}
              className="px-4 py-2.5 md:py-2 bg-cobalt hover:bg-cobalt-hover disabled:bg-ink-3 disabled:text-paper-dim text-ink text-sm font-medium rounded-lg md:rounded-md transition-colors touch-target font-display"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Rate Limit Settings Modal */}
      <RateLimitSettingsModal
        open={showRateLimitSettings}
        onClose={() => setShowRateLimitSettings(false)}
        conversationId={activeConversationId}
      />
    </div>
  );
}
