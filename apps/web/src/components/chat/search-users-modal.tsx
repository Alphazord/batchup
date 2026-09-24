"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { API_ENDPOINTS } from "@repo/api-endpoints";
import { useChat } from "@/contexts/chat-context";
import { Avatar } from "./avatar";
import { Modal } from "@/components/modal";
import type { UserResult } from "@/types";

export function SearchUsersModal({
  open,
  onClose,
  onSelectConversation,
}: {
  open: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const { createConversation } = useChat();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setResults([]);
      setError("");
      setIsSearching(false);
    }
  }, [open]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await apiFetch(API_ENDPOINTS.chat.usersSearch + "?" + new URLSearchParams({ q: query })) as { users: UserResult[] };
        setResults(data.users ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleStartDm = useCallback(
    async (userId: string) => {
      setIsSearching(true);
      setError("");
      try {
        const conversationId = await createConversation("dm", undefined, undefined, [userId]);
        if (conversationId) {
          onSelectConversation(conversationId);
          onClose();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start conversation");
      } finally {
        setIsSearching(false);
      }
    },
    [createConversation, onSelectConversation, onClose],
  );

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <h2 className="text-xl font-bold text-paper mb-1 font-display">Start a Conversation</h2>
          <p className="text-sm text-paper-dim">
            Search for someone to message
          </p>
        </div>

        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users"
            className="w-full bg-ink-2 border-[2.5px] border-ink-3 rounded-full pl-8 pr-3 py-2.5 md:py-2 text-sm text-paper placeholder-paper-dim focus:outline-none focus:border-highlighter transition-colors touch-target"
            autoFocus
          />
          {isSearching && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-paper-dim" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => handleStartDm(user.id)}
                className="w-full flex items-center gap-2.5 p-2.5 md:p-2 rounded-lg md:rounded-md text-left hover:bg-ink-3 transition-colors touch-target"
              >
                <Avatar name={user.name} picture={user.picture} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-paper truncate">{user.name}</div>
                  <div className="text-xs text-paper-dim truncate">{user.email}</div>
                </div>
                <svg className="w-4 h-4 text-paper-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {searchQuery && !isSearching && results.length === 0 && (
          <div className="text-center py-8">
            <div className="text-sm text-paper-dim">No users found</div>
          </div>
        )}

        {error && (
          <div className="text-sm text-marker">{error}</div>
        )}

        <div className="flex justify-end pt-2 border-t border-ink-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 md:py-2 text-sm text-paper-dim hover:text-paper transition-colors touch-target"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
