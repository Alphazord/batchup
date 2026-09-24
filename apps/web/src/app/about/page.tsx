import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { BRANDING } from "@/config/branding";

export const metadata: Metadata = {
  title: "About — BatchUp",
  description: `About ${BRANDING.name} — ${BRANDING.tagline}`,
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-ink-1 text-paper">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">About BatchUp</h1>
        <p className="text-paper-dim text-sm mb-8">The group chat your batch never outgrows</p>

        <div className="space-y-10 text-[15px] leading-relaxed">
          <section>
            <p>
              BatchUp is a real-time group chat platform built for communities that need more than what basic messaging apps offer. It&apos;s designed for college batches, work teams, and groups where you need real control — rate limits, roles, and an admin panel that actually works.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">What Makes It Different</h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="text-highlighter font-bold mt-1">→</span>
                <span>
                  <strong>Sub-100ms delivery.</strong> Messages arrive over WebSockets, not polling. Typing indicators, presence, reactions — all real-time.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-highlighter font-bold mt-1">→</span>
                <span>
                  <strong>Admin controls that matter.</strong> Five rate-limit tiers, member management, message deletion, and a search panel that covers every conversation.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-highlighter font-bold mt-1">→</span>
                <span>
                  <strong>Scale without the cost.</strong> Built on Cloudflare&apos;s free tier infrastructure — 7 sharded workers, Durable Objects, D1 databases — handling 3000+ users at $0/month.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-highlighter font-bold mt-1">→</span>
                <span>
                  <strong>No ads, no tracking, no data selling.</strong> Your conversations stay yours. We don&apos;t use advertising cookies or sell data to third parties.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Built by AdnanBuilds</h2>
            <p className="mb-4">
              BatchUp is built and operated by{" "}
              <a href="https://adnanbuilds.online" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                AdnanBuilds
              </a>
              — a one-person operation focused on building practical, well-engineered software.
            </p>
            <p>
              The entire system runs on Cloudflare&apos;s free tier. Zero hosting costs. Open architecture. If you&apos;re curious about how it works, the{" "}
              <a href="https://github.com/buildbyadnan/Realtime-chats-adnanbuilds-product" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                source code
              </a>{" "}
              tells the story.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">The Tech Stack</h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Next.js 16 with React 19 and Server Components</li>
              <li>Cloudflare Workers (8 accounts: 1 primary + 7 shards)</li>
              <li>Durable Objects for WebSocket hosting and message storage</li>
              <li>D1 (SQLite) for persistent data</li>
              <li>Drizzle ORM for type-safe database queries</li>
              <li>Tailwind CSS v4 for styling</li>
              <li>Google OAuth 2.0 with PKCE for authentication</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
