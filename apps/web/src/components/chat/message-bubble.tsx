"use client";

import { useState, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/auth-context";
import { useChat } from "@/contexts/chat-context";
import { Avatar } from "./avatar";
import { useGesture } from "@/hooks/use-gesture";
import { formatTime } from "@/lib/utils";
import type { Message, ConversationMember } from "@repo/types";
import { SUPPORTED_EMOJIS } from "@repo/types";

function ReactionPicker({
  onSelect,
  onClose,
  position,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { top: number; right: number };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed flex flex-wrap gap-0.5 bg-ink-2 border-[2.5px] border-ink-3 rounded-[14px] px-1.5 py-1 shadow-xl z-[100] animate-scale-in max-w-[min(280px,calc(100vw-2rem))]"
      style={{ top: position.top, right: position.right }}
    >
      {SUPPORTED_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="text-lg w-10 h-10 md:w-8 md:h-8 flex items-center justify-center hover:bg-ink-3 rounded-full transition-colors hover:scale-110 touch-target"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function DeleteConfirm({
  onConfirm,
  onCancel,
  position,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  position: { top: number; right: number };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="fixed bg-ink-2 border-[2.5px] border-ink-3 rounded-[14px] p-3 shadow-xl z-[100] animate-scale-in w-64 max-w-[calc(100vw-2rem)]"
      style={{ top: position.top, right: position.right }}
    >
      <p className="text-[13.5px] text-paper mb-3">Delete message?</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 text-[13.5px] text-paper-dim hover:text-paper hover:bg-ink-3 rounded-full transition-colors touch-target"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-2 text-[13.5px] bg-marker hover:bg-marker/80 text-white rounded-full transition-colors font-medium touch-target"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  member,
  replyTo,
  replyToMember,
  myMember: _myMember,
  memberMap,
  isGrouped,
  onReply,
  onEdit,
  onDelete,
  scrollToMessage,
  isOpen,
  onToggleActions,
  onCloseActions,
}: {
  message: Message;
  member?: ConversationMember;
  replyTo?: Message | null;
  replyToMember?: ConversationMember | null;
  myMember?: ConversationMember;
  memberMap?: Map<string, ConversationMember>;
  isGrouped: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  scrollToMessage?: (messageId: string) => void;
  isOpen: boolean;
  onToggleActions: () => void;
  onCloseActions: () => void;
}) {
  const { user } = useAuth();
  const { addReaction, removeReaction } = useChat();
  const isOwn = message.senderId === user?.id;

  const isDeleted = !!message.deletedAt;
  const reactions = message.reactions ?? {};
  const isGroupAdmin = _myMember?.role === "owner" || _myMember?.role === "admin";
  const canEdit = isOwn && !message.deletedAt && (Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000) && message.type !== "system";
  const canDelete = isOwn || isGroupAdmin;

  const [isNew, setIsNew] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const [moreMenuPos, setMoreMenuPos] = useState({ top: 0, right: 0 });
  const [pickerPos, setPickerPos] = useState({ top: 0, right: 0 });

  // Close more menu on click outside
  useEffect(() => {
    if (!showMoreMenu) return;
    function handleClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMoreMenu]);

  // Gesture handling for swipe-to-reply and long-press
  const { state: gestureState, handlers: gestureHandlers } = useGesture({
    onSwipeRight: onReply,
    onLongPress: () => onToggleActions(),
  });

  useEffect(() => {
    if (!isGrouped) {
      setIsNew(true);
      const t = setTimeout(() => setIsNew(false), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-1.5 px-3 md:px-4">
        <span className="text-xs text-paper-dim">{message.content}</span>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message.id}`}
      data-message-row
      className={`group msg relative flex gap-2 md:gap-3 px-3 md:px-4 py-0.5 message-row no-touch-callout ${
        isOwn ? "flex-row-reverse" : ""
      } ${isGrouped ? "" : "mt-3"} ${isNew ? "animate-highlight-fade" : ""}`}
      style={{
        transform: gestureState.isSwiping ? `translateX(${gestureState.swipeOffset}px)` : undefined,
        transition: gestureState.isSwiping ? "none" : "transform 0.2s ease-out",
        touchAction: "pan-y",
      }}
      onClick={() => onToggleActions()}
      {...gestureHandlers}
    >
      {/* Swipe reply indicator */}
      {gestureState.isSwiping && gestureState.swipeOffset > 30 && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center pl-1">
          <svg className="w-5 h-5 text-cobalt" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </div>
      )}

      {/* Avatar / timestamp column — mobile: hide avatars for grouped messages */}
      {!isGrouped ? (
        <div className="w-8 md:w-10 shrink-0 pt-0.5">
          <Avatar
            name={member?.name ?? "Unknown"}
            picture={member?.picture ?? null}
            size="sm"
          />
        </div>
      ) : (
        <div className="w-8 md:w-10 shrink-0 flex items-center justify-center">
          <span className="text-[10px] text-paper-dim md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {formatTime(message.createdAt)}
          </span>
        </div>
      )}

      {/* Message content */}
      <div className={`flex-1 min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
        {/* Sender name + timestamp (only for non-grouped) */}
        {!isGrouped && (
          <div className={`flex items-baseline gap-2 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="text-[14px] font-600 text-paper font-display">
              {member?.name ?? "Unknown"}
            </span>
            <span className="font-mono text-[10px] text-paper-faint">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {/* Message bubble */}
        {isDeleted ? (
          <div className="text-[14px] text-paper-dim italic flex items-center gap-1.5">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            This message has been deleted.
          </div>
        ) : (
          <div className="relative max-w-[min(300px,80vw)]">
            <div
              className={`text-[14.5px] text-paper whitespace-pre-wrap break-words leading-relaxed font-body overflow-hidden ${
                isOwn
                  ? "bg-cobalt text-white rounded-[14px_14px_4px_14px] px-4 py-2.5"
                  : "bg-ink-4 border border-ink-3 rounded-[14px_14px_14px_4px] px-4 py-2.5"
              }`}
            >
              {/* Reply quote inside bubble */}
              {replyTo && (
                <div
                  onClick={(e) => { e.stopPropagation(); scrollToMessage?.(message.replyToId!); }}
                  className={`reply-quote ${isOwn ? "reply-quote-mine" : ""} mb-2 cursor-pointer`}
                >
                  <div className="reply-quote-name">{replyToMember?.name ?? "Unknown"}</div>
                  <div className="reply-quote-text">
                    {replyTo.deletedAt ? "[Message deleted]" : replyTo.content}
                  </div>
                </div>
              )}

              {message.content}
              {message.editedAt && (
                <span className={`text-[10px] ml-1 ${isOwn ? "text-white/60" : "text-paper-faint"}`}>(edited)</span>
              )}
            </div>

            {/* Hover actions — CSS-driven */}
            {!isDeleted && (
              <div className={`hover-actions ${isOpen ? "hover-actions-open" : ""} ${isOwn ? "right-0" : "left-auto right-0"}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!showReactions) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setPickerPos({ top: rect.top - 4, right: window.innerWidth - rect.right });
                    }
                    setShowReactions(!showReactions);
                  }}
                  className="icon-btn !w-7 !h-7"
                  title="Add Reaction"
                  aria-label="Add reaction"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </button>
                {message.replyCount === 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReply(); onCloseActions(); }}
                    className="icon-btn !w-7 !h-7"
                    title="Reply"
                    aria-label="Reply to message"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                    </svg>
                  </button>
                )}
                <button
                  ref={moreBtnRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!showMoreMenu && moreBtnRef.current) {
                      const rect = moreBtnRef.current.getBoundingClientRect();
                      setMoreMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    }
                    setShowMoreMenu(!showMoreMenu);
                  }}
                  className="icon-btn !w-7 !h-7"
                  title="More"
                  aria-label="More actions"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                  </svg>
                </button>

                {showMoreMenu && createPortal(
                  <div ref={moreMenuRef} className="fixed bg-ink-2 border-[2.5px] border-ink-3 rounded-lg shadow-xl z-[100] animate-scale-in w-40 overflow-hidden" style={{ top: moreMenuPos.top, right: moreMenuPos.right }}>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit();
                          setShowMoreMenu(false);
                          onCloseActions();
                        }}
                        className="w-full px-3 py-2.5 text-[13px] text-paper-dim hover:bg-ink-3 text-left transition-colors touch-target flex items-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (moreBtnRef.current) {
                            const rect = moreBtnRef.current.getBoundingClientRect();
                            setPickerPos({ top: rect.top - 4, right: window.innerWidth - rect.right });
                          }
                          setShowDeleteConfirm(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2.5 text-[13px] text-marker hover:bg-ink-3 text-left transition-colors touch-target flex items-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>,
                  document.body
                )}

                {showReactions && createPortal(
                  <ReactionPicker
                    onSelect={(emoji) => {
                      addReaction(message.id, emoji);
                      setShowReactions(false);
                    }}
                    onClose={() => setShowReactions(false)}
                    position={pickerPos}
                  />,
                  document.body
                )}

                {showDeleteConfirm && createPortal(
                  <DeleteConfirm
                    onConfirm={() => {
                      onDelete();
                      setShowDeleteConfirm(false);
                    }}
                    onCancel={() => setShowDeleteConfirm(false)}
                    position={pickerPos}
                  />,
                  document.body
                )}
              </div>
            )}
          </div>
        )}

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
            {Object.entries(reactions).map(([emoji, userIds]) => {
              const hasReacted = userIds.includes(user?.id ?? "");
              return (
                <button
                  key={emoji}
                  onClick={() =>
                    hasReacted
                      ? removeReaction(message.id, emoji)
                      : addReaction(message.id, emoji)
                  }
                  className={`reaction-chip ${hasReacted ? "reaction-chip-active" : ""}`}
                  title={userIds.map((uid) => memberMap?.get(uid)?.name ?? uid).join(", ")}
                >
                  <span>{emoji}</span>
                  <span className="font-600">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Reply count */}
        {message.replyCount > 0 && (
          <div className={`text-[12px] text-cobalt mt-1 hover:underline cursor-pointer ${isOwn ? "text-right" : ""}`}>
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </div>
        )}

        {/* Timestamp below bubble (for grouped messages) */}
        {isGrouped && (
          <div className={`text-[10px] font-mono text-paper-faint mt-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${isOwn ? "text-right" : ""}`}>
            {formatTime(message.createdAt)}
          </div>
        )}
      </div>
    </div>
  );
});
