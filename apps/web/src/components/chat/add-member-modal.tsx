"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChat } from "@/contexts/chat-context";
import { apiFetch } from "@/lib/api";
import { API_ENDPOINTS } from "@repo/api-endpoints";
import { Avatar } from "./avatar";
import { Modal } from "@/components/modal";
import type { UserResult } from "@/types";

export function AddMemberModal({
  open,
  onClose,
  conversationId,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
}) {
  const { addMember, members } = useChat();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const existingMemberIds = new Set(members.map((m) => m.userId));

  const resetForm = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUsers([]);
    setError("");
    setIsSearching(false);
    setIsAdding(false);
    setSuccess(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      searchTimeout.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const data = (await apiFetch(
            API_ENDPOINTS.chat.usersSearch + "?" + new URLSearchParams({ q: query }),
          )) as { users: UserResult[] };
          setSearchResults(
            (data.users ?? []).filter(
              (u: UserResult) =>
                !existingMemberIds.has(u.id) && !selectedUsers.some((s) => s.id === u.id),
            ),
          );
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [selectedUsers, existingMemberIds],
  );

  const toggleUser = useCallback((user: UserResult) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    );
  }, []);

  const handleAdd = useCallback(async () => {
    if (selectedUsers.length === 0) return;
    setIsAdding(true);
    setError("");

    try {
      for (const user of selectedUsers) {
        await addMember(conversationId, user.id);
      }
      setSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add members");
    } finally {
      setIsAdding(false);
    }
  }, [selectedUsers, addMember, conversationId, onClose]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-[17px] font-bold text-paper font-display">Add Members</h2>
          <p className="text-[13px] text-paper-dim mt-0.5">Search and add people to this group</p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 space-y-4 min-h-0">
          {/* Search users */}
          <div>
            <label className="block font-mono text-[10.5px] font-semibold text-paper-dim uppercase mb-1.5">
              Search People
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or email"
                className="w-full bg-ink border-[2.5px] border-ink-3 rounded-full pl-9 pr-3 py-2.5 text-[13.5px] text-paper placeholder-paper-faint focus:outline-none focus:border-highlighter transition-colors touch-target"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="w-4 h-4 animate-spin text-paper-faint"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="flex items-center gap-1 px-2 py-1 bg-cobalt/20 text-cobalt text-[12px] rounded-full"
                >
                  {user.name}
                  <button
                    onClick={() => toggleUser(user)}
                    className="hover:text-white transition-colors p-0.5 touch-target"
                    aria-label={`Remove ${user.name}`}
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-[14px] text-left hover:bg-ink-3 transition-colors touch-target"
                >
                  <Avatar name={user.name} picture={user.picture} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-paper truncate">{user.name}</div>
                    <div className="text-[11px] text-paper-faint truncate">{user.email}</div>
                  </div>
                  <svg
                    className="w-4 h-4 text-paper-faint"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {success && (
            <div className="text-[13px] text-online">Members added successfully!</div>
          )}

          {error && <div className="text-[13px] text-signal">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t-[2.5px] border-ink-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[13.5px] text-paper-dim hover:text-paper transition-colors touch-target rounded-full"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedUsers.length === 0 || isAdding || success}
            className="inline-flex items-center justify-center rounded-full font-body font-bold text-[14px] px-[22px] py-[11px] border-[2.5px] transition-colors touch-target bg-cobalt text-white border-transparent hover:bg-cobalt-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? "Adding..." : success ? "Added!" : `Add ${selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
