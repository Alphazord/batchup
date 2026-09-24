"use client";

export function EmptyState({
  onStartChat,
  onOpenCreateGroup,
}: {
  onStartChat: () => void;
  onOpenCreateGroup: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-ink px-6">
      <img src="/app-icon.svg" alt="BatchUp" width={80} height={80} className="mb-6 rounded-[18px]" />
      <div className="font-display font-700 text-[20px] text-paper">
        Nothing here yet.
      </div>
      <div className="mt-2 text-[13.5px] text-paper-dim text-center max-w-[280px]">
        Your batch is waiting. Start chatting now.
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-[10px]">
        <button
          onClick={onStartChat}
          className="inline-flex items-center justify-center rounded-full font-body font-bold text-[14px] px-[22px] py-[11px] border-[2.5px] transition-colors touch-target bg-highlighter text-ink border-transparent hover:bg-highlighter-dim"
        >
          New Chat
        </button>
        <button
          onClick={onOpenCreateGroup}
          className="inline-flex items-center justify-center rounded-full font-body font-bold text-[14px] px-[22px] py-[11px] border-[2.5px] transition-colors touch-target bg-cobalt text-white border-transparent hover:bg-cobalt-hover"
        >
          Create Group
        </button>
      </div>
    </div>
  );
}
