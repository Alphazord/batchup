"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useChat } from "@/contexts/chat-context";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "./avatar";
import { AddMemberModal } from "./add-member-modal";
import { isRecentlyActive } from "@/lib/utils";
import type { ConversationMember } from "@repo/types";

function RoleIcon({ role }: { role: string }) {
  if (role === "owner") {
    return (
      <svg className="w-3.5 h-3.5 text-cobalt shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    );
  }
  if (role === "admin") {
    return (
      <svg className="w-3.5 h-3.5 text-online shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
      </svg>
    );
  }
  return null;
}

function MemberActions({
  member,
  isOwner: _isOwner,
  isGroupAdmin,
  onRemove,
}: {
  member: ConversationMember;
  isOwner: boolean;
  isGroupAdmin: boolean;
  onRemove: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (member.role === "owner") return null;
  if (!isGroupAdmin) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 md:p-1 rounded text-paper-dim hover:text-paper hover:bg-ink-3 transition-colors md:opacity-0 md:group-hover:opacity-100 touch-target"
        aria-label="Member actions"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-ink-2 border-[2.5px] border-ink-3 rounded-lg shadow-xl z-20 animate-scale-in w-44 overflow-hidden max-h-[200px] overflow-y-auto">
          <button
            onClick={() => {
              onRemove(member.userId);
              setOpen(false);
            }}
            className="w-full px-3 py-2.5 md:py-2 text-sm text-marker hover:bg-ink-3 text-left transition-colors touch-target"
          >
            Remove from group
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmPopover({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
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
      className="bg-ink-2 border-[2.5px] border-ink-3 rounded-lg p-3 shadow-xl z-20 animate-scale-in max-w-[min(280px,calc(100vw-2rem))]"
    >
      <p className="text-sm text-paper mb-3">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 text-sm text-paper-dim hover:text-paper hover:bg-ink-3 rounded-[14px] transition-colors touch-target"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-2 text-sm bg-marker hover:bg-marker/80 text-white rounded-[14px] transition-colors font-medium touch-target"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

const MemberItem = memo(function MemberItem({
  member,
  online,
  isOwner,
  isGroupAdmin,
  onRemove,
}: {
  member: ConversationMember;
  online: boolean;
  isOwner: boolean;
  isGroupAdmin: boolean;
  onRemove: (userId: string) => void;
}) {
  return (
    <div className="group flex items-center gap-2.5 px-2 py-2 md:py-1.5 rounded-lg md:rounded-md transition-colors">
      <Avatar name={member.name} picture={member.picture} size="sm" online={online} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className={`text-sm truncate ${online ? "text-paper" : "text-paper-dim"}`}>
          {member.name}
        </span>
        <RoleIcon role={member.role} />
      </div>
      <MemberActions
        member={member}
        isOwner={isOwner}
        isGroupAdmin={isGroupAdmin}
        onRemove={onRemove}
      />
    </div>
  );
});

export function MemberList() {
  const { user } = useAuth();
  const { members, onlineUsers, activeConversationId, leaveGroup, removeMember, refreshConversations, setActiveConversation } = useChat();
  const { toast } = useToast();
  const [offlineExpanded, setOfflineExpanded] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ConversationMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAllOffline, setShowAllOffline] = useState(false);

  const myMember = useMemo(() => members.find((m) => m.userId === user?.id), [members, user]);
  const isGroupOwner = myMember?.role === "owner";
  const isGroupAdmin = myMember?.role === "owner" || myMember?.role === "admin";

  const online = useMemo(() => members.filter((m) => {
    const presence = onlineUsers.get(m.userId);
    return presence && isRecentlyActive(presence.lastSeen);
  }), [members, onlineUsers]);

  const offline = useMemo(() => members.filter((m) => {
    const presence = onlineUsers.get(m.userId);
    return !presence || !isRecentlyActive(presence.lastSeen);
  }), [members, onlineUsers]);

  const handleLeave = useCallback(async () => {
    if (!activeConversationId) return;
    const leavingId = activeConversationId;
    try {
      await leaveGroup(leavingId);
      toast("success", "Left group");
      await refreshConversations();
      setActiveConversation(null);
    } catch {
      toast("error", "Failed to leave group");
    }
    setShowLeaveConfirm(false);
  }, [activeConversationId, leaveGroup, toast, refreshConversations, setActiveConversation]);

  const handleRemove = useCallback(async (userId: string) => {
    if (!activeConversationId) return;
    try {
      await removeMember(activeConversationId, userId);
      const name = members.find((m) => m.userId === userId)?.name ?? "Member";
      toast("success", `${name} removed from group`);
    } catch {
      toast("error", "Failed to remove member");
    }
    setRemoveTarget(null);
  }, [activeConversationId, removeMember, members, toast]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 px-2 py-3">
        {online.length > 0 && (
          <div>
            <div className="px-2 mb-1 text-xs font-semibold text-paper-dim uppercase tracking-wider">
              Online — {online.length}
            </div>
            <div className="space-y-0.5">
              {online.map((m) => (
                <MemberItem
                  key={m.userId}
                  member={m}
                  online
                  isOwner={isGroupOwner}
                  isGroupAdmin={isGroupAdmin}
                  onRemove={() => setRemoveTarget(m)}
                />
              ))}
            </div>
          </div>
        )}

        {offline.length > 0 && (
          <div>
            <button
              onClick={() => setOfflineExpanded(!offlineExpanded)}
              className="flex items-center gap-1 px-2 mb-1 text-xs font-semibold text-paper-dim uppercase tracking-wider hover:text-paper-dim/80 transition-colors w-full"
            >
              <svg
                className={`w-3 h-3 transition-transform ${offlineExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Offline — {offline.length}
            </button>
            {offlineExpanded && (
              <div className="space-y-0.5 animate-fade-in">
                {(showAllOffline ? offline : offline.slice(0, 100)).map((m) => (
                  <MemberItem
                    key={m.userId}
                    member={m}
                    online={false}
                    isOwner={isGroupOwner}
                    isGroupAdmin={isGroupAdmin}
                    onRemove={() => setRemoveTarget(m)}
                  />
                ))}
                {offline.length > 100 && !showAllOffline && (
                  <button
                    onClick={() => setShowAllOffline(true)}
                    className="w-full px-2 py-1.5 text-xs text-cobalt hover:text-cobalt-hover transition-colors text-left"
                  >
                    Show all {offline.length} members...
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add member button (admin/owner only) */}
      {isGroupAdmin && activeConversationId && (
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={() => setShowAddMember(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 text-sm font-medium bg-cobalt hover:bg-cobalt-hover text-white rounded-[14px] md:rounded-md transition-colors touch-target"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        </div>
      )}

      {/* Leave group / confirmation */}
      {!isGroupOwner && (
        <div className="px-3 py-3 border-t border-ink-3 shrink-0">
          {showLeaveConfirm ? (
            <ConfirmPopover
              message="Are you sure you want to leave this group?"
              onConfirm={handleLeave}
              onCancel={() => setShowLeaveConfirm(false)}
            />
          ) : (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full px-3 py-2.5 md:py-2 text-sm font-medium bg-marker hover:bg-marker/80 text-white rounded-[14px] md:rounded-md transition-colors touch-target"
            >
              Leave Group
            </button>
          )}
        </div>
      )}

      {/* Remove member confirmation */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setRemoveTarget(null)}
        >
          <div className="mx-4" onClick={(e) => e.stopPropagation()}>
            <ConfirmPopover
              message={`Remove ${removeTarget.name} from this group?`}
              onConfirm={() => handleRemove(removeTarget.userId)}
              onCancel={() => setRemoveTarget(null)}
            />
          </div>
        </div>
      )}

      {/* Add member modal */}
      {activeConversationId && (
        <AddMemberModal
          open={showAddMember}
          onClose={() => setShowAddMember(false)}
          conversationId={activeConversationId}
        />
      )}
    </div>
  );
}
