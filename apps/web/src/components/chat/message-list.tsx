"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

function formatDateDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function DateDivider({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3 px-4 my-4">
      <div className="flex-1 h-px bg-ink-3" />
      <span className="text-[11px] font-medium text-paper-faint shrink-0">
        {formatDateDivider(iso)}
      </span>
      <div className="flex-1 h-px bg-ink-3" />
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="px-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="w-10 h-10 rounded-full skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 skeleton" />
              <div className="h-3 w-16 skeleton" />
            </div>
            <div className="h-4 w-3/4 skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList({
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
}: {
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReplyMessage: (messageId: string) => void;
}) {
  const { messages, members, loadingMessages, hasMoreMessages, loadOlderMessages } = useChat();
  const { user } = useAuth();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const prevScrollHeight = useRef(0);
  const [openActionsMessageId, setOpenActionsMessageId] = useState<string | null>(null);
  const rafPending = useRef(false);
  const highlightTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Memoize member lookup (O(1) per member)
  const memberMap = useMemo(() => {
    const map = new Map<string, (typeof members)[0]>();
    for (const m of members) {
      map.set(m.userId, m);
    }
    return map;
  }, [members]);

  // Memoize message lookup (O(1) per replyTo) — fixes O(n²) .find() in render loop
  const messageMap = useMemo(() => {
    const map = new Map<string, (typeof messages)[0]>();
    for (const m of messages) {
      map.set(m.id, m);
    }
    return map;
  }, [messages]);

  // Memoize message index lookup for scrollToMessage (O(1) instead of O(n) findIndex)
  const messageIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < messages.length; i++) {
      map.set(messages[i].id, i);
    }
    return map;
  }, [messages]);

  // Memoize current user's member info
  const myMember = useMemo(() => members.find((m) => m.userId === user?.id), [members, user]);

  // Auto-scroll to bottom on new messages (only if near bottom)
  const shouldAutoScroll = useRef(true);
  useEffect(() => {
    if (shouldAutoScroll.current && messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: "end" });
    }
  }, [messages.length]);

  // Preserve scroll position when older messages are prepended
  useEffect(() => {
    if (prevScrollHeight.current > 0 && virtuosoRef.current) {
      // Virtuoso handles scroll preservation via firstItemIndex
      prevScrollHeight.current = 0;
    }
  }, [messages]);

  // Throttled scroll handler via requestAnimationFrame
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (rafPending.current) return;

      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        const container = e.target as HTMLDivElement;
        if (!container) return;

        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        shouldAutoScroll.current = isNearBottom;
        setShowScrollButton(!isNearBottom);

        if (
          container.scrollTop < 100 &&
          hasMoreMessages &&
          !loadingOlder &&
          !loadingMessages
        ) {
          prevScrollHeight.current = container.scrollHeight;
          setLoadingOlder(true);
          loadOlderMessages().finally(() => setLoadingOlder(false));
        }
      });
    },
    [hasMoreMessages, loadingOlder, loadingMessages, loadOlderMessages],
  );

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: "end" });
    setShowScrollButton(false);
    shouldAutoScroll.current = true;
  }, [messages.length]);

  const scrollToMessage = useCallback((messageId: string) => {
    const idx = messageIndexMap.get(messageId);
    if (idx !== undefined) {
      virtuosoRef.current?.scrollToIndex({ index: idx, align: "center" });
      // Highlight effect via timeout (can't query DOM immediately after scroll)
      const t1 = setTimeout(() => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
          el.classList.add("animate-highlight-fade");
          const t2 = setTimeout(() => el.classList.remove("animate-highlight-fade"), 2000);
          highlightTimers.current.push(t2);
        }
      }, 100);
      highlightTimers.current.push(t1);
    }
  }, [messageIndexMap]);

  // Clean up highlight timeouts on unmount
  useEffect(() => {
    return () => {
      highlightTimers.current.forEach((t) => clearTimeout(t));
      highlightTimers.current = [];
    };
  }, []);

  // Close action bars when clicking outside
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-message-row]")) {
      setOpenActionsMessageId(null);
    }
  }, []);

  // Group messages and insert date dividers for Virtuoso
  const elements = useMemo(() => {
    const result: Array<{ type: "message" | "divider"; key: string; data?: unknown }> = [];
    let lastDate = "";

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgDate = new Date(msg.createdAt).toDateString();

      if (msgDate !== lastDate) {
        result.push({ type: "divider", key: `divider-${msgDate}` });
        lastDate = msgDate;
      }

      const prev = i > 0 ? messages[i - 1] : null;
      const isGrouped =
        prev &&
        prev.senderId === msg.senderId &&
        !prev.deletedAt &&
        !msg.deletedAt &&
        new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 60_000 &&
        new Date(msg.createdAt).toDateString() === new Date(prev.createdAt).toDateString();

      result.push({ type: "message", key: msg.id, data: { msg, isGrouped: !!isGrouped } });
    }

    return result;
  }, [messages]);

  if (loadingMessages && messages.length === 0) {
    return (
      <div className="relative flex-1 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <MessageSkeleton />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="relative flex-1 overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="w-16 h-16 rounded-full bg-ink-3 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-paper-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-[17px] font-semibold text-paper mb-1 font-display">
            No messages yet
          </div>
          <div className="text-[13.5px] text-paper-dim">
            Send the first message to start the conversation
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden" onClick={handleContainerClick}>
      {loadingOlder && (
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center py-2 bg-ink/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-paper-faint text-[12px]">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading older messages...
          </div>
        </div>
      )}

      <Virtuoso
        ref={virtuosoRef}
        totalCount={elements.length}
        overscan={200}
        onScroll={handleScroll}
        initialTopMostItemIndex={elements.length - 1}
        followOutput="auto"
        itemContent={(index) => {
          const el = elements[index];
          if (!el) return null;

          if (el.type === "divider") {
            const dateStr = el.key.replace("divider-", "");
            return <DateDivider iso={dateStr} />;
          }

          const { msg, isGrouped } = el.data as {
            msg: (typeof messages)[0];
            isGrouped: boolean;
          };

          // O(1) lookup instead of O(n) .find()
          const replyToMsg = msg.replyToId ? messageMap.get(msg.replyToId) ?? null : null;
          const replyToMember = replyToMsg ? memberMap.get(replyToMsg.senderId) : null;

          return (
            <MessageBubble
              message={msg}
              member={memberMap.get(msg.senderId)}
              replyTo={replyToMsg}
              replyToMember={replyToMember}
              myMember={myMember}
              memberMap={memberMap}
              isGrouped={isGrouped}
              onReply={() => onReplyMessage(msg.id)}
              onEdit={() => onEditMessage(msg.id, msg.content)}
              onDelete={() => onDeleteMessage(msg.id)}
              scrollToMessage={scrollToMessage}
              isOpen={openActionsMessageId === msg.id}
              onToggleActions={() =>
                setOpenActionsMessageId(openActionsMessageId === msg.id ? null : msg.id)
              }
              onCloseActions={() => setOpenActionsMessageId(null)}
            />
          );
        }}
        components={{
          Footer: () => (
            <>
              <TypingIndicator />
              {!hasMoreMessages && messages.length > 0 && (
                <div className="flex justify-center py-6">
                  <div className="text-[11px] text-paper-faint font-medium">
                    Beginning of conversation
                  </div>
                </div>
              )}
            </>
          ),
        }}
      />

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-cobalt hover:bg-cobalt-hover text-white text-[12px] font-medium rounded-full shadow-lg transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          New messages
        </button>
      )}
    </div>
  );
}
