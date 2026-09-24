"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/auth-context";
import { useChat } from "@/contexts/chat-context";
import { Avatar } from "./avatar";
import { GroupInfoModal } from "./group-info-modal";
import { isRecentlyActive } from "@/lib/utils";

function HeaderMenu({
  isOwner,
  onEditGroup,
  onRateLimitSettings,
}: {
  isOwner: boolean;
  onEditGroup: () => void;
  onRateLimitSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="icon-btn"
        title="More options"
        aria-label="More options"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
        </svg>
      </button>
      {open && createPortal(
        <div
          className="fixed bg-ink-2 border-[2.5px] border-ink-3 rounded-lg shadow-xl z-[100] animate-scale-in w-48 overflow-hidden"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {isOwner && (
            <button
              onClick={() => {
                onEditGroup();
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 text-sm text-paper-dim hover:bg-ink-3 text-left transition-colors touch-target"
            >
              Edit Group
            </button>
          )}
          <button
            onClick={() => {
              onRateLimitSettings();
              setOpen(false);
            }}
            className="w-full px-3 py-2.5 text-sm text-paper-dim hover:bg-ink-3 text-left transition-colors touch-target"
          >
            Rate Limit Settings
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

export function ChatHeader({
  showMembers,
  onToggleMembers,
  onBack,
  onRateLimitSettings,
}: {
  showMembers: boolean;
  onToggleMembers: () => void;
  onBack: () => void;
  onRateLimitSettings: () => void;
}) {
  const { user } = useAuth();
  const { conversations, activeConversationId, members, membersLoading, onlineUsers, connected, hasEverConnected, error } = useChat();
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const conversation = useMemo(() => conversations.find((c) => c.id === activeConversationId), [conversations, activeConversationId]);
  const myMember = useMemo(() => members.find((m) => m.userId === user?.id), [members, user]);
  const isDm = conversation?.type === "dm";
  const onlineCount = useMemo(() => members.filter((m) => {
    const presence = onlineUsers.get(m.userId);
    return presence && isRecentlyActive(presence.lastSeen);
  }).length, [members, onlineUsers]);
  const otherMember = useMemo(() => isDm ? members.find((m) => m.userId !== user?.id) : null, [isDm, members, user]);

  if (!conversation) return null;

  const isGroupAdmin = myMember?.role === "owner" || myMember?.role === "admin";
  const otherPresence = otherMember ? onlineUsers.get(otherMember.userId) : null;
  const isOtherOnline = otherPresence ? isRecentlyActive(otherPresence.lastSeen) : false;

  const displayName = isDm && conversation.otherUserName
    ? conversation.otherUserName
    : conversation.name ?? "Direct Message";

  const displayPicture = isDm ? (conversation.otherUserPicture ?? null) : null;

  return (
    <>
    <div className="chat-header">
      {/* Back button — mobile only */}
      <button
        onClick={onBack}
        className="chat-back-btn md:hidden"
        aria-label="Back to conversations"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>

      <Avatar
        name={displayName}
        picture={displayPicture}
        size="md"
        online={isDm ? isOtherOnline : undefined}
      />

      <div className="chat-header-info">
        <h2 className="chat-header-name">{displayName}</h2>
        <span className="chat-header-status">
          {isDm ? (
            membersLoading ? (
              <span className="text-paper-dim">Loading...</span>
            ) : (
              <span className={isOtherOnline ? "text-online" : ""}>
                {isOtherOnline ? "Online" : "Offline"}
              </span>
            )
          ) : (
            <>
              {conversation.memberCount} members
              {onlineCount > 0 && <span className="ml-1">· {onlineCount} online</span>}
            </>
          )}
        </span>
      </div>

      <div className="chat-header-actions">
        {/* Connection indicator */}
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-online pulse-dot" : "bg-paper-dim"
          }`}
          title={connected ? "Connected" : "Disconnected"}
        />

        {/* Members toggle (groups only) */}
        {!isDm && (
          <button
            onClick={onToggleMembers}
            className={`icon-btn ${
              showMembers ? "!text-paper !bg-ink-3" : ""
            }`}
            title={showMembers ? "Hide Members" : "Show Members"}
            aria-label={showMembers ? "Hide Members" : "Show Members"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
        )}

        {/* Overflow menu (groups only) */}
        {!isDm && (
          <HeaderMenu
            isOwner={isGroupAdmin}
            onEditGroup={() => setShowGroupInfo(true)}
            onRateLimitSettings={onRateLimitSettings}
          />
        )}
      </div>
    </div>

    {!connected && hasEverConnected && !error && (
      <div className="bg-highlighter/10 border-b border-highlighter/30 px-4 py-2 text-sm text-highlighter shrink-0 animate-fade-in flex items-center gap-2 overflow-hidden">
        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="truncate">Connection lost. Reconnecting...</span>
      </div>
    )}
    {error && (
      <div className="bg-highlighter/10 border-b border-highlighter/30 px-4 py-2 text-sm text-highlighter shrink-0 animate-fade-in overflow-hidden">
        <span className="truncate block">{error}</span>
      </div>
    )}

    {/* Group Info Modal */}
    <GroupInfoModal
      open={showGroupInfo}
      onClose={() => setShowGroupInfo(false)}
      conversationId={conversation.id}
      initialName={conversation.name ?? ""}
      initialDescription={conversation.description ?? ""}
    />
    </>
  );
}
