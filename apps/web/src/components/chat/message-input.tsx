"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { useChat } from "@/contexts/chat-context";
import { Avatar } from "./avatar";
import { SUPPORTED_EMOJIS } from "@repo/types";

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: globalThis.KeyboardEvent) {
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
      className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-0.5 bg-ink-2 border-[2.5px] border-ink-3 rounded-[14px] px-1.5 py-1 shadow-xl z-[40] animate-scale-in max-w-[min(280px,calc(100vw-2rem))]"
    >
      {SUPPORTED_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="text-lg w-10 h-10 md:w-8 md:h-8 flex items-center justify-center hover:bg-ink-3 rounded-full transition-colors hover:scale-110 touch-target"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function MessageInput({
  replyTo,
  onCancelReply,
}: {
  replyTo?: { messageId: string; senderName: string; content: string } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const { sendMessage, startTyping, stopTyping, error } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);

  const isRateLimited = error?.includes("Slow down") ?? false;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    sendMessage(trimmed, replyTo?.messageId);
    setText("");
    stopTyping();
    onCancelReply?.();
  }, [text, sendMessage, stopTyping, replyTo, onCancelReply]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      if (value.trim()) {
        startTyping();
      }
    },
    [startTyping],
  );

  return (
    <div className={`chat-input-area shrink-0 px-3 md:px-4 pb-3 md:pb-4 safe-area-inset ${replyTo ? "pt-1" : "pt-2"}`}>
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-ink-3 rounded-lg border border-ink-4">
          <svg className="w-4 h-4 shrink-0 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <Avatar
            name={replyTo.senderName}
            picture={null}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-600 text-paper">
              {replyTo.senderName}
            </span>
            <span className="text-[12px] text-paper-dim ml-2 truncate">
              {replyTo.content}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1.5 rounded text-paper-dim hover:text-paper hover:bg-ink-2 transition-colors touch-target"
            aria-label="Cancel reply"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Composer — pill-shaped */}
      <div className="composer-wrapper">
        <div className={`composer ${isRateLimited ? "opacity-50" : ""}`}>
          {/* Emoji picker trigger */}
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="icon-btn"
              title="Emoji"
              aria-label="Open emoji picker"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={(emoji) => {
                  setText((prev) => prev + emoji);
                  setShowEmoji(false);
                  inputRef.current?.focus();
                }}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRateLimited ? "Slow down! Wait a moment..." : "Message..."}
            disabled={isRateLimited}
            autoComplete="off"
            autoCapitalize="sentences"
            className="composer-input"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() || isRateLimited}
          className="send-btn"
          title="Send message"
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
