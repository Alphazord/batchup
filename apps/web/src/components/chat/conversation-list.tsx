"use client";

import { useState, memo, useMemo } from "react";
import { useChat } from "@/contexts/chat-context";
import { Avatar } from "./avatar";
import type { ConversationListItem, PresenceUser } from "@repo/types";
import { isRecentlyActive, formatTime } from "@/lib/utils";

function formatPreview(preview: string | null): string {
  if (!preview) return "No messages yet";
  return preview.length > 45 ? preview.slice(0, 45) + "..." : preview;
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onClick,
  onlineUsers,
}: {
  conversation: ConversationListItem;
  isActive: boolean;
  onClick: () => void;
  onlineUsers: Map<string, PresenceUser>;
}) {
  const hasUnread =
    conversation.lastMessageAt &&
    conversation.lastReadAt &&
    new Date(conversation.lastMessageAt).getTime() > new Date(conversation.lastReadAt).getTime();

  const isDm = conversation.type === "dm";
  const dmName = conversation.otherUserName ?? "Direct Message";
  const otherPresence = conversation.otherUserId ? onlineUsers.get(conversation.otherUserId) : null;
  const isOtherOnline = otherPresence ? isRecentlyActive(otherPresence.lastSeen) : false;
  const displayName = isDm ? dmName : (conversation.name ?? "Direct Message");

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors text-left outline-none touch-target ${
        isActive
          ? "convo-active bg-ink-2"
          : "hover:bg-ink-3/50"
      }`}
    >
      <Avatar
        name={displayName}
        picture={isDm ? (conversation.otherUserPicture ?? null) : null}
        size="md"
        online={isDm ? isOtherOnline : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className={`text-[14px] truncate ${
              hasUnread ? "font-600 text-paper" : "text-paper-dim"
            }`}
          >
            {displayName}
          </span>
          <span className="font-mono text-[10px] text-paper-faint shrink-0">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-[12px] text-paper-dim truncate">
            {formatPreview(conversation.lastMessagePreview)}
          </span>
          {hasUnread && (
            conversation.unreadCount && conversation.unreadCount > 0 ? (
              <span className="min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[10px] font-bold bg-highlighter text-ink rounded-full shrink-0">
                {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-paper shrink-0" />
            )
          )}
        </div>
      </div>
    </button>
  );
});

export function ConversationList({
  onOpenCreateGroup,
  onOpenSearchUsers,
  onConversationSelect,
  filter,
}: {
  onOpenCreateGroup?: () => void;
  onOpenSearchUsers?: () => void;
  onConversationSelect?: () => void;
  filter?: "messages" | "groups";
}) {
  const { conversations, activeConversationId, setActiveConversation, onlineUsers } = useChat();
  const [searchFilter, setSearchFilter] = useState("");
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);

  const filtered = useMemo(() => conversations.filter((c) => {
    if (!searchFilter) return true;
    const name = c.type === "dm" ? (c.otherUserName ?? "Direct Message") : (c.name ?? "Direct Message");
    return name.toLowerCase().includes(searchFilter.toLowerCase());
  }), [conversations, searchFilter]);

  const groups = useMemo(() => filtered.filter((c) => c.type === "group"), [filtered]);
  const dms = useMemo(() => filtered.filter((c) => c.type === "dm"), [filtered]);

  const showGroups = filter !== "messages";
  const showDms = filter !== "groups";

  const handleConversationClick = (conversationId: string) => {
    setActiveConversation(conversationId);
    onConversationSelect?.();
  };

  const SectionHeader = ({
    label,
    count,
    expanded,
    onToggle,
  }: {
    label: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 px-3.5 mb-0.5 font-mono text-[10.5px] text-paper-faint uppercase tracking-[0.05em] hover:text-paper-dim transition-colors w-full"
    >
      <svg
        className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      {label} — {count}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-3">
      {/* Search */}
      <div className="px-1">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="w-full bg-ink border-[2.5px] border-ink-3 rounded-full pl-8 pr-3 py-2 md:py-1.5 text-[13.5px] text-paper placeholder-paper-faint focus:outline-none focus:border-highlighter transition-colors touch-target"
          />
        </div>
      </div>

      {/* Groups */}
      {showGroups && groups.length > 0 && (
        <div>
          <SectionHeader
            label="Groups"
            count={groups.length}
            expanded={groupsExpanded}
            onToggle={() => setGroupsExpanded(!groupsExpanded)}
          />
          {groupsExpanded && (
            <div className="space-y-0.5">
              {groups.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  isActive={c.id === activeConversationId}
                  onClick={() => handleConversationClick(c.id)}
                  onlineUsers={onlineUsers}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DMs */}
      {showDms && dms.length > 0 && (
        <div>
          <SectionHeader
            label="Direct Messages"
            count={dms.length}
            expanded={dmsExpanded}
            onToggle={() => setDmsExpanded(!dmsExpanded)}
          />
          {dmsExpanded && (
            <div className="space-y-0.5">
              {dms.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  isActive={c.id === activeConversationId}
                  onClick={() => handleConversationClick(c.id)}
                  onlineUsers={onlineUsers}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — filter active but section is empty */}
      {filter && ((filter === "groups" && groups.length === 0) || (filter === "messages" && dms.length === 0)) && !searchFilter && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-ink-3 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-sm text-paper-dim">
            {filter === "groups" ? "No groups yet" : "No messages yet"}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !searchFilter && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-ink-3 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-sm text-paper-dim mb-4">
            No conversations yet
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={onOpenSearchUsers}
              className="inline-flex items-center justify-center rounded-full font-body font-bold text-[14px] px-[22px] py-[11px] border-[2.5px] transition-colors touch-target bg-highlighter text-ink border-transparent hover:bg-highlighter-dim"
            >
              Start Chat
            </button>
            <button
              onClick={onOpenCreateGroup}
              className="inline-flex items-center justify-center rounded-full font-body font-bold text-[14px] px-[22px] py-[11px] border-[2.5px] transition-colors touch-target bg-cobalt text-white border-transparent hover:bg-cobalt-hover"
            >
              Create Group
            </button>
          </div>
        </div>
      )}
      {filtered.length === 0 && searchFilter && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-ink-3 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-sm text-paper-dim">
            No conversations found
          </div>
        </div>
      )}
    </div>
  );
}
