"use client";

import { useAuth } from "@/contexts/auth-context";
import { useChat } from "@/contexts/chat-context";

export function TypingIndicator() {
  const { typingUsers, members } = useChat();
  const { user } = useAuth();

  const othersTyping = typingUsers.filter((t) => t.userId !== user?.id);

  if (othersTyping.length === 0) return null;

  const names = othersTyping
    .map((t) => members.find((m) => m.userId === t.userId)?.name)
    .filter(Boolean) as string[];

  if (names.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 md:px-4 py-1">
      <div className="typing-bubble">
        <span className="typing-bubble-dot" />
        <span className="typing-bubble-dot" />
        <span className="typing-bubble-dot" />
      </div>
    </div>
  );
}
