"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChatProvider, useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { MemberList } from "@/components/chat/member-list";
import { MobileTabBar } from "@/components/chat/mobile-tab-bar";
import { ProfileTab } from "@/components/chat/profile-tab";
import { ErrorBoundary } from "@/components/error-boundary";

type MobileTab = "chats" | "groups" | "profile";
type RailIcon = "messages" | "groups" | "settings";

function ChatLayoutInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>("chats");
  const [activeIcon, setActiveIcon] = useState<RailIcon>("messages");
  const { activeConversationId, conversations } = useChat();

  // Detect viewport — 2 tiers: mobile/tablet (<1000px) vs desktop (≥1000px)
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 1000);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-close member panel when switching to a DM
  useEffect(() => {
    if (!activeConversationId) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (conv?.type === "dm") {
      setMembersOpen(false);
    }
  }, [activeConversationId, conversations]);

  // Close sidebar on mobile when conversation is selected
  const handleConversationSelect = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Tab change handler
  const handleTabChange = useCallback((tab: MobileTab) => {
    setActiveTab(tab);
    if (tab === "chats" || tab === "groups") {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarOpen(false);
    }
  }, []);

  // Redirect to login if not authenticated (after auth check completes)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Show loading spinner while auth is checking
  if (authLoading) {
    return (
      <div className="flex h-dvh bg-ink items-center justify-center">
        <div className="flex items-center gap-3 text-paper-faint">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── Desktop (≥1000px): 4-column grid ──────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex h-dvh bg-ink text-paper overflow-hidden safe-area-top">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-highlighter focus:text-ink focus:rounded-full">
          Skip to content
        </a>

        {/* Rail — hidden below 1000px */}
        <div className="hidden lg:flex flex-col items-center py-6 px-0 gap-4 bg-ink-2 border-r-[2.5px] border-ink-3 w-[76px] shrink-0">
          {/* Brand mark */}
          <img src="/app-icon.svg" alt="BatchUp" width={42} height={42} className="mb-2 rounded-[11px]" />

          {/* Nav icons */}
          <button
            onClick={() => setActiveIcon("messages")}
            className={`w-[44px] h-[44px] rounded-[14px] flex items-center justify-center transition-colors relative ${
              activeIcon === "messages"
                ? "bg-ink-3 text-highlighter"
                : "text-paper-dim hover:bg-ink-3 hover:text-paper"
            }`}
            title="Messages"
            aria-label="Messages"
          >
            {activeIcon === "messages" && (
              <div className="absolute left-[-12px] w-[3px] h-5 bg-highlighter rounded-r-full" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          </button>
          <button
            onClick={() => setActiveIcon("groups")}
            className={`w-[44px] h-[44px] rounded-[14px] flex items-center justify-center transition-colors relative ${
              activeIcon === "groups"
                ? "bg-ink-3 text-highlighter"
                : "text-paper-dim hover:bg-ink-3 hover:text-paper"
            }`}
            title="Groups"
            aria-label="Groups"
          >
            {activeIcon === "groups" && (
              <div className="absolute left-[-12px] w-[3px] h-5 bg-highlighter rounded-r-full" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Settings */}
          <button
            onClick={() => setActiveIcon("settings")}
            className={`w-[44px] h-[44px] rounded-[14px] flex items-center justify-center transition-colors relative ${
              activeIcon === "settings"
                ? "bg-ink-3 text-highlighter"
                : "text-paper-dim hover:bg-ink-3 hover:text-paper"
            }`}
            title="Settings"
            aria-label="Settings"
          >
            {activeIcon === "settings" && (
              <div className="absolute left-[-12px] w-[3px] h-5 bg-highlighter rounded-r-full" />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>

        {/* Conversation list — desktop column */}
        <div className="hidden md:flex flex-col bg-ink-2 border-r-[2.5px] border-ink-3 w-[320px] shrink-0 min-w-0 overflow-hidden">
          <Sidebar onClose={() => {}} onConversationSelect={handleConversationSelect} filter={activeIcon === "settings" ? undefined : activeIcon} />
        </div>

        {/* Main chat area */}
        <div id="main-content" className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ErrorBoundary>
            <ChatWindow
              onMenuToggle={() => setSidebarOpen(true)}
              onMembersToggle={() => setMembersOpen((prev) => !prev)}
              membersOpen={membersOpen}
              onStartChat={() => setSidebarOpen(true)}
              onOpenCreateGroup={() => {}}
            />
          </ErrorBoundary>
        </div>

        {/* Right panel — hidden below 1200px */}
        <div className="hidden lg:flex flex-col bg-ink-2 border-l-[2.5px] border-ink-3 w-[260px] shrink-0 min-w-0 overflow-y-auto">
          {activeIcon === "settings" ? (
            <ProfileTab />
          ) : (
            <>
              <div className="p-6">
                <h2 className="font-display text-[15px] font-700 mb-1">Conversation</h2>
                <span className="font-mono text-[10px] py-[5px] px-[11px] rounded-full border-[2.5px] border-ink-4 text-paper-dim inline-block mb-5">
                  🎓 Founding Batch of 2026
                </span>
              </div>
              <div className="px-4 pb-4 flex-1 overflow-y-auto">
                <MemberList />
              </div>
            </>
          )}
        </div>

      </div>
    );
  }

  // ── Mobile/Tablet (<1000px): single column with slide-over ─────────
  return (
    <div className="flex h-dvh bg-ink text-paper overflow-hidden safe-area-top relative">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-highlighter focus:text-ink focus:rounded-full">
        Skip to content
      </a>

      {/* Mobile backdrop for sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Conversation list — mobile: full-screen base layer */}
      <div
        className={`
          absolute inset-0 z-50 flex flex-col bg-ink-2 overflow-hidden
          transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ paddingBottom: "74px" }}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} onConversationSelect={handleConversationSelect} />
      </div>

      {/* Chat — mobile: slides in from right */}
      <div
        id="main-content"
        className={`
          absolute inset-0 z-[6] flex flex-col overflow-hidden
          transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-full" : "translate-x-0"}
        `}
      >
        <ErrorBoundary>
          {activeTab === "profile" ? (
            <ProfileTab />
          ) : (
            <ChatWindow
              onMenuToggle={() => setSidebarOpen(true)}
              onMembersToggle={() => setMembersOpen((prev) => !prev)}
              membersOpen={membersOpen}
              onStartChat={() => setSidebarOpen(true)}
              onOpenCreateGroup={() => {}}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Mobile bottom nav */}
      <MobileTabBar activeTab={activeTab} onTabChange={handleTabChange} />

    </div>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <ChatLayoutInner />
      {children}
    </ChatProvider>
  );
}
