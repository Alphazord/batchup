import type { Metadata } from "next";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Security — BatchUp",
  description: "How BatchUp protects your data and your conversations.",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-ink-1 text-paper">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">Security</h1>
        <p className="text-paper-dim text-sm mb-8">How we protect you and your data</p>

        <div className="space-y-10 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Your Data Is Protected in Transit</h2>
            <p>
              Every connection to BatchUp — whether you&apos;re browsing the website, signing in, or chatting — is encrypted using TLS 1.3, the latest and most secure transport encryption standard. This means no one can intercept or read your data while it travels between your device and our servers. We enforce HTTPS everywhere with HSTS (HTTP Strict Transport Security) to prevent any downgrade attacks.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Secure Authentication</h2>
            <p className="mb-4">
              BatchUp uses Google Sign-In (OAuth 2.0) for authentication. This means:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>We never see or store your Google password</li>
              <li>You sign in directly with Google, and Google confirms your identity to us</li>
              <li>Your session is protected with cryptographically signed tokens that expire after 7 days</li>
              <li>Sessions automatically rotate to prevent long-term token exposure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Access Controls</h2>
            <p className="mb-4">
              Every conversation on BatchUp is protected by membership verification. This means:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>You can only see conversations you&apos;ve been added to</li>
              <li>Messages can only be fetched if you&apos;re a verified member of that conversation</li>
              <li>Each connection to a chat room requires a fresh, short-lived authentication token (5-minute expiry)</li>
              <li>Tokens are scoped to a specific conversation — a token for one chat cannot be used to access another</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Infrastructure Security</h2>
            <p className="mb-4">
              BatchUp runs on Cloudflare&apos;s global edge network, which provides:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li><strong>DDoS protection:</strong> Automatic mitigation of distributed denial-of-service attacks</li>
              <li><strong>Edge computing:</strong> Your chat runs on servers close to you for fast, reliable delivery</li>
              <li><strong>Disk encryption:</strong> All stored data is encrypted at the disk level by Cloudflare</li>
              <li><strong>Isolation:</strong> Each conversation runs in its own isolated environment (Durable Object), so conversations cannot interfere with each other</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Rate Limiting and Abuse Prevention</h2>
            <p>
              BatchUp has a multi-layer rate limiting system that prevents spam and abuse. Group administrators can configure rate limits for their conversations, ranging from relaxed to strict. This ensures one busy group doesn&apos;t flood everyone&apos;s notifications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">What We Can and Cannot See</h2>

            <h3 className="text-lg font-bold mb-3">We CAN see:</h3>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li>Your name, email, and profile picture (provided by Google)</li>
              <li>Messages you send and receive (stored as part of the chat service)</li>
              <li>Which conversations you belong to</li>
              <li>When you&apos;re online and typing</li>
            </ul>

            <h3 className="text-lg font-bold mb-3">We CANNOT see:</h3>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Your Google password</li>
              <li>Your device&apos;s local files or data</li>
              <li>Other apps on your device</li>
              <li>Your precise location (geolocation is disabled)</li>
              <li>Your camera or microphone (permissions are disabled)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">What We Do NOT Have</h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li><strong>No end-to-end encryption:</strong> Messages are readable by the server. This is the same model as Slack, Discord, and Telegram (non-secret chats). If you need E2E encryption, we recommend using a dedicated encrypted messaging app for sensitive conversations.</li>
              <li><strong>No advertising or tracking:</strong> We do not use advertising cookies, tracking pixels, or sell your data to advertisers.</li>
              <li><strong>No data selling:</strong> Your data is never sold to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Reporting Vulnerabilities</h2>
            <p>
              If you discover a security vulnerability in BatchUp, please report it responsibly by emailing{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>
              . We will respond to reports within 48 hours.
            </p>
          </section>

          <section className="border-t border-ink-3 pt-8">
            <p className="text-paper-dim text-sm">
              For how we handle your data, see our{" "}
              <a href="/privacy" className="text-highlighter hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
