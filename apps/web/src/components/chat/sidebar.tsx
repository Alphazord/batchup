"use client";

import { useState, useCallback } from "react";
import { useChat } from "@/contexts/chat-context";
import { ConversationList } from "./conversation-list";
import { CreateGroupModal } from "./create-group-modal";
import { SearchUsersModal } from "./search-users-modal";

interface SidebarProps {
  onClose?: () => void;
  onConversationSelect?: () => void;
  filter?: "messages" | "groups";
}

export function Sidebar({ onClose: _onClose, onConversationSelect, filter }: SidebarProps) {
  const { setActiveConversation } = useChat();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSearchUsers, setShowSearchUsers] = useState(false);

  const handleStartDm = useCallback(
    (conversationId: string) => {
      setActiveConversation(conversationId);
      onConversationSelect?.();
    },
    [setActiveConversation, onConversationSelect],
  );

  return (
    <>
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b-[2.5px] border-ink-3 shrink-0">
        <span className="text-sm font-semibold text-paper truncate font-display">
          Conversations
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearchUsers(true)}
            className="p-2 rounded text-paper-dim hover:text-paper hover:bg-ink-3 transition-colors touch-target"
            title="New DM"
            aria-label="Start new direct message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 rounded text-paper-dim hover:text-paper hover:bg-ink-3 transition-colors touch-target"
            title="Create Group"
            aria-label="Create group conversation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <ConversationList
        onOpenCreateGroup={() => setShowCreateGroup(true)}
        onOpenSearchUsers={() => setShowSearchUsers(true)}
        onConversationSelect={onConversationSelect}
        filter={filter}
      />

      {/* Modals */}
      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
      <SearchUsersModal
        open={showSearchUsers}
        onClose={() => setShowSearchUsers(false)}
        onSelectConversation={handleStartDm}
      />
    </>
  );
}
