"use client";

import { GoogleButton } from "./google-button";
import { Footer } from "./footer";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "Real-time, actually real-time",
    description:
      "Sub-100ms delivery over WebSockets, with typing indicators that scale \u2014 one name, three names, or \u201Cseveral people typing.\u201D",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
    title: "Edit, delete, reply, react",
    description:
      "15-minute edit window, admin-level deletes, single-level replies with quote-and-jump, 10 reactions per message.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      </svg>
    ),
    title: "Roles & rate limits, admin-set",
    description:
      "Owner, admin, member \u2014 with five configurable rate-limit tiers so one chaotic group doesn\u2019t flood everyone else\u2019s phone.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Closed rooms, not a public feed",
    description:
      "Every batch is its own space. Real profiles, no anonymous pile-ons, no follower counts \u2014 just your actual people.",
  },
];

const MILESTONES = [
  { count: 100, label: "First 100", icon: "\uD83C\uDF31" },
  { count: 500, label: "Halfway there", icon: "\uD83D\uDE80" },
  { count: 1000, label: "The big one-K", icon: "\uD83C\uDF1F" },
  { count: 5000, label: "Campus-wide", icon: "\uD83C\uDF0D" },
];

function PhoneMockup() {
  return (
    <div aria-hidden="true" className="relative w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[380px]">
      <div className="bg-[var(--ink-2)] border-2 border-[var(--ink-3)] rounded-[22px] sm:rounded-[26px] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,.45)] sm:shadow-[0_40px_90px_rgba(0,0,0,.5)]">
        {/* Status bar */}
        <div className="flex justify-between items-center px-4 sm:px-5 pt-2.5 sm:pt-3 pb-0.5 sm:pb-1 text-[9px] sm:text-[10px] text-[var(--paper-faint)]" style={{ fontFamily: "var(--mono)" }}>
          <span>9:41</span>
          <span>{"\u25CF\u25CF\u25CF"} 100%</span>
        </div>

        {/* Chat header */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b-2 border-[var(--ink)] flex justify-between items-center">
          <div>
            <div className="font-bold text-[13px] sm:text-[14px] lg:text-[15px] text-[var(--paper)]" style={{ fontFamily: "var(--display)" }}>
              Tech Batch &apos;27
            </div>
            <div className="text-[9px] sm:text-[10px] lg:text-[10.5px] text-[var(--online)]" style={{ fontFamily: "var(--mono)" }}>
              {"\u25CF"} 43 online {"\u00B7"} 128 members
            </div>
          </div>
          <div className="text-[var(--paper-dim)] text-base" style={{ fontFamily: "var(--mono)" }}>{"\u22EE"}</div>
        </div>

        {/* Messages */}
        <div
          className="p-2.5 sm:p-3 lg:p-4 flex flex-col gap-2 sm:gap-2.5 lg:gap-3 min-h-[240px] sm:min-h-[300px] lg:min-h-[360px]"
          style={{
            background:
              "radial-gradient(circle at 15% 8%,rgba(107,124,255,.10),transparent 40%), radial-gradient(circle at 90% 70%,rgba(255,92,125,.08),transparent 45%)",
          }}
        >
          {/* System message */}
          <div className="self-center text-[8px] sm:text-[9px] lg:text-[10px] text-[var(--paper-dim)] bg-[var(--ink)] py-1 px-2 sm:px-2.5 lg:px-3 rounded-full" style={{ fontFamily: "var(--mono)" }}>
            Priya created the group Tech Batch &apos;27
          </div>

          {/* Message 1 */}
          <div className="flex flex-col max-w-[80%] animate-slide-in-right" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
            <div className="text-[9px] sm:text-[10px] lg:text-[10.5px] text-[var(--cobalt)] mb-0.5 px-1" style={{ fontFamily: "var(--mono)" }}>@alice</div>
            <div className="bg-[var(--ink-3)] border-2 border-[var(--ink)] rounded-[13px_13px_13px_4px] sm:rounded-[15px_15px_15px_4px] px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-1.5 lg:py-2 text-[12px] sm:text-[13px] lg:text-[14px] text-[var(--paper)]">
              anyone have notes from today&apos;s DBMS class?
              <span className="block text-[7px] sm:text-[8px] lg:text-[9px] opacity-60 mt-0.5" style={{ fontFamily: "var(--mono)" }}>10:30 AM</span>
            </div>
          </div>

          {/* Message 2 */}
          <div className="flex flex-col max-w-[80%] animate-slide-in-right" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
            <div className="text-[9px] sm:text-[10px] lg:text-[10.5px] text-[var(--cobalt)] mb-0.5 px-1" style={{ fontFamily: "var(--mono)" }}>@bob</div>
            <div className="bg-[var(--ink-3)] border-2 border-[var(--ink)] rounded-[13px_13px_13px_4px] sm:rounded-[15px_15px_15px_4px] px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-1.5 lg:py-2 text-[12px] sm:text-[13px] lg:text-[14px] text-[var(--paper)]">
              yep sending in a sec
              <div className="flex gap-1 mt-1 flex-wrap">
                <span className="bg-[var(--ink)] border border-[var(--ink-3)] rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] lg:text-[11px]">{"\uD83D\uDD25"} 3</span>
                <span className="bg-[var(--ink)] border border-[var(--ink-3)] rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] lg:text-[11px]">{"\uD83D\uDC40"} 1</span>
              </div>
              <span className="block text-[7px] sm:text-[8px] lg:text-[9px] opacity-60 mt-0.5" style={{ fontFamily: "var(--mono)" }}>10:32 AM</span>
            </div>
          </div>

          {/* Message 3 -- own */}
          <div className="flex flex-col max-w-[80%] self-end items-end animate-fade-in" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
            <div className="text-[9px] sm:text-[10px] lg:text-[10.5px] text-[var(--marker)] mb-0.5 px-1" style={{ fontFamily: "var(--mono)" }}>you</div>
            <div className="bg-[var(--cobalt)] text-white border-2 border-[var(--cobalt)] rounded-[13px_13px_4px_13px] sm:rounded-[15px_15px_4px_15px] px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-1.5 lg:py-2 text-[12px] sm:text-[13px] lg:text-[14px]">
              bless you bob, actual mvp
              <span className="block text-[7px] sm:text-[8px] lg:text-[9px] opacity-60 mt-0.5" style={{ fontFamily: "var(--mono)" }}>10:33 AM {"\u00B7"} {"\u270E"} edited</span>
            </div>
          </div>

          {/* Typing indicator */}
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] lg:text-[11px] text-[var(--paper-dim)] px-1 animate-fade-in" style={{ animationDelay: "0.7s", animationFillMode: "both", fontFamily: "var(--mono)" }}>
            Charlie is typing
            <div className="flex gap-[3px]">
              <span className="w-[4px] sm:w-[4px] lg:w-[5px] h-[4px] sm:h-[4px] lg:h-[5px] rounded-full bg-[var(--highlighter)] typing-dot" />
              <span className="w-[4px] sm:w-[4px] lg:w-[5px] h-[4px] sm:h-[4px] lg:h-[5px] rounded-full bg-[var(--highlighter)] typing-dot" />
              <span className="w-[4px] sm:w-[4px] lg:w-[5px] h-[4px] sm:h-[4px] lg:h-[5px] rounded-full bg-[var(--highlighter)] typing-dot" />
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex gap-2 px-2.5 sm:px-3 lg:px-3.5 py-2 sm:py-2.5 lg:py-3 bg-[var(--ink-3)] border-t-2 border-[var(--ink)]">
          <div className="flex-1 bg-[var(--ink)] rounded-full px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-1.5 lg:py-2 text-[11px] sm:text-[12px] lg:text-[13px] text-[var(--paper-dim)]">
            Message Tech Batch &apos;27{"\u2026"}
          </div>
          <div className="bg-[var(--highlighter)] text-[var(--ink)] rounded-full px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-1.5 lg:py-2 font-bold text-[10px] sm:text-[11px] lg:text-[12px]">Send</div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!loading && user) {
      router.push("/chat");
    }
  }, [user, loading, router]);

  // Scroll-triggered reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    const sections = sectionsRef.current.filter((el): el is HTMLElement => el !== null);
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--paper)] overflow-x-hidden">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-[1]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-4 backdrop-blur-[12px] bg-[rgba(18,19,42,.7)] border-b border-[var(--ink-3)]">
        <a href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none" className="shrink-0 sm:w-6 sm:h-6">
            <rect width="40" height="40" rx="11" fill="#DFFF4F" />
            <path d="M10 16C10 13.79 11.79 12 14 12H22C25.31 12 28 14.69 28 18C28 20.4 26.61 22.47 24.6 23.45L28 27H22.5L20 24H14C11.79 24 10 22.21 10 20V16Z" fill="#12132A" />
            <path d="M17 27L21 21H26L22 27H17Z" fill="#12132A" />
          </svg>
          <span className="font-extrabold text-[16px] sm:text-[18px] md:text-[20px] tracking-[-0.02em] text-[var(--paper)]" style={{ fontFamily: "var(--display)" }}>
            BatchUp
          </span>
        </a>
        <nav className="hidden sm:flex items-center gap-5 md:gap-6 text-[12.5px] text-[var(--paper-dim)]" style={{ fontFamily: "var(--mono)" }}>
          <a href="#features" className="hover:text-[var(--paper)] transition-colors">Product</a>
          <a href="#why" className="hover:text-[var(--paper)] transition-colors">Why it exists</a>
          <GoogleButton size="nav" />
        </nav>
        <div className="sm:hidden shrink-0 ml-2">
          <a href="#join" className="bg-[var(--highlighter)] text-[var(--ink)] px-4 py-2 rounded-full font-bold text-[11px] tracking-wide" style={{ fontFamily: "var(--mono)" }}>Get started</a>
        </div>
      </header>

      <main className="relative z-[2]">
        {/* Hero */}
        <section className="min-h-screen flex flex-col justify-center px-4 sm:px-6 md:px-8 pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 relative overflow-hidden">
          {/* Ambient blobs */}
          <div className="absolute w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-[var(--marker)] rounded-full blur-[90px] sm:blur-[120px] opacity-20 sm:opacity-28 -top-32 sm:-top-44 -right-24 sm:-right-40 z-0" />
          <div className="absolute w-[300px] sm:w-[480px] h-[300px] sm:h-[480px] bg-[var(--cobalt)] rounded-full blur-[90px] sm:blur-[120px] opacity-20 sm:opacity-28 -bottom-40 sm:-bottom-56 -left-20 sm:-left-36 z-0" />

          <div className="max-w-[1200px] mx-auto w-full relative z-[2]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-center">
              {/* Left -- Copy */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left order-1">
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 mb-4 sm:mb-5 md:mb-6">
                  <span className="w-4 sm:w-5 h-0.5 bg-[var(--highlighter)]" />
                  <span className="text-[10px] sm:text-[11px] md:text-[11.5px] tracking-[0.14em] uppercase text-[var(--highlighter)]" style={{ fontFamily: "var(--mono)" }}>
                    Now coming live at MJCET!
                  </span>
                  <span className="w-4 sm:w-5 h-0.5 bg-[var(--highlighter)]" />
                </div>

                {/* Headline */}
                <h1 className="font-extrabold text-[40px] sm:text-[clamp(48px,10vw,110px)] leading-[0.88] tracking-[-0.03em] m-0">
                  <span className="block" style={{ fontFamily: "var(--display)" }}>batch</span>
                  <span
                    className="text-[var(--ink)] bg-[var(--highlighter)] px-2.5 sm:px-3 lg:px-4 pb-0.5 rounded-lg sm:rounded-xl -rotate-3 inline-block ml-1 sm:ml-1.5 lg:ml-2 mt-1 sm:mt-1.5 lg:mt-2 text-[0.55em] sm:text-[0.58em] lg:text-[0.6em]"
                    style={{ fontFamily: "var(--display)" }}
                  >
                    up
                  </span>
                </h1>

                {/* Subheadline */}
                <p className="text-[14px] sm:text-[15px] md:text-[clamp(16px,2.2vw,20px)] text-[var(--paper-dim)] max-w-[400px] sm:max-w-[440px] md:max-w-[500px] mt-4 sm:mt-5 md:mt-7 font-medium leading-relaxed">
                  Not another corporate inbox. Not a public feed.{" "}
                  <b className="text-[var(--paper)] font-bold">The one group chat your batch never outgrows</b>{" "}
                  {"\u2014"} reactions, replies, roles, and rate limits an admin actually controls.
                </p>

                {/* CTA cluster */}
                <div className="flex flex-col items-center lg:items-start gap-3 mt-6 sm:mt-8 md:mt-10 w-full max-w-[280px] sm:max-w-none">
                  <GoogleButton size="hero" />
                  <span className="text-[11px] sm:text-[11px] md:text-[12px] text-[var(--paper-dim)]" style={{ fontFamily: "var(--mono)" }}>
                    Sign in with Google {"\u2014"} free, no credit card
                  </span>
                </div>

                {/* Founding batch badge */}
                <div className="mt-4 sm:mt-5 md:mt-6 inline-flex items-center gap-2 bg-[var(--ink-2)] border border-[var(--ink-3)] rounded-full px-3 sm:px-3.5 md:px-4 py-1.5 sm:py-1.5 md:py-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--online)] animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] md:text-[12px] text-[var(--paper-dim)]" style={{ fontFamily: "var(--mono)" }}>
                    Founding Batch {"\u00B7"} MJCET &apos;26
                  </span>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-2 sm:flex mt-8 sm:mt-10 md:mt-14 border-t border-[var(--ink-3)] w-full max-w-[460px] sm:max-w-none">
                  {[
                    { num: "Free", label: "forever, no catch" },
                    { num: "1,000", label: "concurrent, no lag" },
                    { num: "<100ms", label: "message delivery" },
                    { num: "30s", label: "to set up a group" },
                  ].map((stat, i) => (
                    <div
                      key={stat.label}
                      className={`pt-3 sm:pt-3.5 md:pt-4 px-2.5 sm:px-3 md:px-5 text-left ${i < 2 ? "border-r border-[var(--ink-3)]" : ""} ${i < 2 ? "border-b sm:border-b-0 border-[var(--ink-3)]" : ""} ${i < 2 ? "pb-3 sm:pb-0" : ""}`}
                    >
                      <div className="text-base sm:text-lg md:text-2xl font-bold text-[var(--highlighter)]" style={{ fontFamily: "var(--mono)" }}>{stat.num}</div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-[var(--paper-dim)] mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right -- Live chat preview */}
              <div className="flex justify-center order-2 lg:order-2">
                <PhoneMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Positioning */}
        <section
          ref={(el) => { sectionsRef.current[0] = el; }}
          className="scroll-reveal py-14 sm:py-16 md:py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--ink-3)]"
        >
          <div className="max-w-[1100px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-20 items-start">
              <div>
                <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="w-4 sm:w-5 h-0.5 bg-[var(--marker)]" />
                  <span className="text-[10px] sm:text-[11px] md:text-[11.5px] tracking-[0.14em] uppercase text-[var(--marker)]" style={{ fontFamily: "var(--mono)" }}>
                    Why we&apos;re building this
                  </span>
                </div>
                <h2 className="font-extrabold text-[24px] sm:text-[28px] md:text-[clamp(30px,4.5vw,48px)] tracking-[-0.02em] m-0 mb-2.5 sm:mb-3 md:mb-4 leading-[1.05]" style={{ fontFamily: "var(--display)" }}>
                  WhatsApp is where your batch ended up.
                </h2>
                <p className="font-bold text-[18px] sm:text-[20px] md:text-[clamp(22px,3.5vw,30px)] leading-[1.35] m-0" style={{ fontFamily: "var(--display)" }}>
                  BatchUp is where your batch actually{" "}
                  <span className="text-[var(--highlighter)]">lives.</span>
                </p>
              </div>
              <div className="flex flex-col gap-3.5 sm:gap-4 md:gap-5">
                <p className="text-[13px] sm:text-[14px] md:text-[15.5px] text-[var(--paper-dim)] leading-relaxed m-0">
                  Students already run their social lives across a dozen WhatsApp groups and one messy Discord server. BatchUp merges WhatsApp&apos;s speed with Discord&apos;s roles and admin control, in one app neither techy nor non-techy users have to learn twice.
                </p>
                <p className="text-[13px] sm:text-[14px] md:text-[15.5px] text-[var(--paper-dim)] leading-relaxed m-0">
                  The alumni layer is what turns it from &ldquo;another campus app&rdquo; into lasting infrastructure {"\u2014"} a graph of your college&apos;s people that compounds in value every year instead of resetting at graduation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          ref={(el) => { sectionsRef.current[1] = el; }}
          className="scroll-reveal py-14 sm:py-16 md:py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--ink-3)]"
        >
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-8 sm:mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2 mb-3 sm:mb-3.5">
                <span className="w-4 sm:w-5 h-0.5 bg-[var(--cobalt)]" />
                <span className="text-[10px] sm:text-[11px] md:text-[11.5px] tracking-[0.14em] uppercase text-[var(--cobalt)]" style={{ fontFamily: "var(--mono)" }}>
                  The product
                </span>
                <span className="w-4 sm:w-5 h-0.5 bg-[var(--cobalt)]" />
              </div>
              <h2 className="font-extrabold text-[24px] sm:text-[28px] md:text-[clamp(30px,4.5vw,48px)] tracking-[-0.02em] m-0 mb-2.5 sm:mb-3 md:mb-4 leading-[1.05]" style={{ fontFamily: "var(--display)" }}>
                This is the actual app.<br className="hidden sm:block" /> Not a mockup.
              </h2>
              <p className="text-[13px] sm:text-[14px] md:text-[16.5px] text-[var(--paper-dim)] max-w-[440px] sm:max-w-[500px] md:max-w-[560px] mx-auto">
                Every pixel below ships today: live reactions, single-level replies, edit &amp; delete, adaptive typing, and admin-set rate limits {"\u2014"} running on the edge, everywhere.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 md:gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group bg-[var(--ink-2)] border-2 border-[var(--ink-3)] rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 hover:border-[var(--highlighter)]/30 transition-colors duration-200"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 shrink-0 bg-[var(--ink)] border border-[var(--ink-3)] rounded-[10px] sm:rounded-[11px] md:rounded-[13px] flex items-center justify-center text-[var(--highlighter)] mb-2.5 sm:mb-3 md:mb-4">
                    {f.icon}
                  </div>
                  <h4 className="text-[14px] sm:text-[15px] md:text-[17px] m-0 mb-1 sm:mb-1.5 text-[var(--paper)]" style={{ fontFamily: "var(--display)" }}>{f.title}</h4>
                  <p className="text-[12px] sm:text-[13px] md:text-sm text-[var(--paper-dim)] m-0 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Founding Batch */}
        <section
          id="why"
          ref={(el) => { sectionsRef.current[2] = el; }}
          className="scroll-reveal py-14 sm:py-16 md:py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--ink-3)]"
        >
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-8 sm:mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2 mb-3 sm:mb-3.5">
                <span className="w-4 sm:w-5 h-0.5 bg-[var(--highlighter)]" />
                <span className="text-[10px] sm:text-[11px] md:text-[11.5px] tracking-[0.14em] uppercase text-[var(--highlighter)]" style={{ fontFamily: "var(--mono)" }}>
                  Founding Batch
                </span>
                <span className="w-4 sm:w-5 h-0.5 bg-[var(--highlighter)]" />
              </div>
              <h2 className="font-extrabold text-[24px] sm:text-[28px] md:text-[clamp(30px,4.5vw,48px)] tracking-[-0.02em] m-0 mb-2.5 sm:mb-3 md:mb-4 leading-[1.05]" style={{ fontFamily: "var(--display)" }}>
                Every batch starts somewhere.
              </h2>
              <p className="text-[13px] sm:text-[14px] md:text-[16.5px] text-[var(--paper-dim)] max-w-[440px] sm:max-w-[500px] md:max-w-[560px] mx-auto">
                MJCET is the founding campus. You&apos;re not just joining an app {"\u2014"} you&apos;re the first batch that makes it real.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
              {MILESTONES.map((m) => (
                <div key={m.count} className="bg-[var(--ink-2)] border-2 border-[var(--ink-3)] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 md:p-5 text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl mb-1.5 sm:mb-2 md:mb-3">{m.icon}</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--highlighter)]" style={{ fontFamily: "var(--mono)" }}>
                    #{m.count.toLocaleString()}
                  </div>
                  <div className="text-[10px] sm:text-[11px] md:text-[12px] text-[var(--paper-dim)] mt-0.5 sm:mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Join */}
        <section
          id="join"
          ref={(el) => { sectionsRef.current[3] = el; }}
          className="scroll-reveal py-14 sm:py-16 md:py-24 px-4 sm:px-6 md:px-8 text-center border-t border-[var(--ink-3)]"
        >
          <div className="max-w-[600px] mx-auto">
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-3.5">
              <span className="w-4 sm:w-5 h-0.5 bg-[var(--highlighter)]" />
              <span className="text-[10px] sm:text-[11px] md:text-[11.5px] tracking-[0.14em] uppercase text-[var(--highlighter)]" style={{ fontFamily: "var(--mono)" }}>
                Get started
              </span>
              <span className="w-4 sm:w-5 h-0.5 bg-[var(--highlighter)]" />
            </div>
            <h2 className="font-extrabold text-[24px] sm:text-[28px] md:text-[clamp(30px,4.5vw,48px)] tracking-[-0.02em] m-0 mb-2.5 sm:mb-3 md:mb-4 leading-[1.05]" style={{ fontFamily: "var(--display)" }}>
              Start chatting in 30 seconds.
            </h2>
            <p className="text-[13px] sm:text-[14px] md:text-[16.5px] text-[var(--paper-dim)] max-w-[440px] sm:max-w-[500px] md:max-w-[560px] mx-auto mb-6 sm:mb-7 md:mb-8">
              Sign in with Google and create your first group {"\u2014"} no credit card, no setup wizard.
            </p>
            <div className="w-full max-w-[280px] sm:max-w-[300px] mx-auto">
              <GoogleButton size="hero" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
