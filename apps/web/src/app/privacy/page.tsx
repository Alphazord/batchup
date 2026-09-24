import type { Metadata } from "next";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy Policy — BatchUp",
  description: "How BatchUp collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink-1 text-paper">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">Privacy Policy</h1>
        <p className="text-paper-dim text-sm mb-8">Last updated: August 2, 2026</p>

        <div className="space-y-10 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">1. Introduction</h2>
            <p className="mb-4">
              BatchUp (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a real-time group chat application operated by{" "}
              <a href="https://adnanbuilds.online" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                AdnanBuilds
              </a>
              . This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application at{" "}
              <a href="https://batchup.fun" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                batchup.fun
              </a>{" "}
              (the &quot;Service&quot;).
            </p>
            <p>
              By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree, please discontinue use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">2. Information We Collect</h2>
            <h3 className="text-lg font-bold mb-3">2.1 Account Information</h3>
            <p className="mb-4">
              When you sign in with Google, we collect your Google profile information as authorized by you during the OAuth consent flow:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li>Full name</li>
              <li>Email address</li>
              <li>Profile picture</li>
              <li>Google account ID (used as your unique identifier)</li>
            </ul>

            <h3 className="text-lg font-bold mb-3">2.2 Message Content</h3>
            <p className="mb-4">
              We store the content of all messages you send and receive within the Service. Messages are stored as plaintext on our servers. This is necessary to provide the chat functionality, including message history, search, and delivery across devices.
            </p>

            <h3 className="text-lg font-bold mb-3">2.3 Usage Metadata</h3>
            <p className="mb-4">The following usage data is collected and processed:</p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li><strong>Online status:</strong> Whether you are currently connected to the Service</li>
              <li><strong>Typing indicators:</strong> When you are typing a message (ephemeral, not stored)</li>
              <li><strong>Read receipts:</strong> The last time you viewed a conversation</li>
              <li><strong>Message reactions:</strong> Emoji reactions you add to messages</li>
              <li><strong>Conversation membership:</strong> Which conversations you belong to and your role (owner, admin, or member)</li>
              <li><strong>Rate limit data:</strong> Message sending frequency (for abuse prevention)</li>
            </ul>

            <h3 className="text-lg font-bold mb-3">2.4 Device and Connection Information</h3>
            <p className="mb-4">
              Our infrastructure provider (Cloudflare) may collect standard server logs including IP addresses, browser type, operating system, and access times for security and performance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">3. How We Use Your Information</h2>
            <p className="mb-4">We use the collected information for the following purposes:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>To provide and maintain the chat Service</li>
              <li>To authenticate your identity via Google OAuth</li>
              <li>To deliver messages in real-time across your devices</li>
              <li>To display your profile information to other members of your conversations</li>
              <li>To show online status and typing indicators to conversation members</li>
              <li>To enforce rate limits and prevent abuse</li>
              <li>To provide group administrators with member management tools</li>
              <li>To detect and respond to security incidents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">4. Data Storage and Security</h2>
            <h3 className="text-lg font-bold mb-3">4.1 Where Your Data Is Stored</h3>
            <p className="mb-4">
              All data is hosted on Cloudflare&apos;s global infrastructure, which includes Workers, Durable Objects, and D1 databases. Data may be processed in data centers around the world depending on Cloudflare&apos;s edge network routing.
            </p>

            <h3 className="text-lg font-bold mb-3">4.2 Security Measures</h3>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li><strong>Encryption in transit:</strong> All connections are encrypted using TLS 1.3 (HTTPS and WSS). We enforce HSTS with preload to prevent downgrade attacks.</li>
              <li><strong>Infrastructure encryption:</strong> Cloudflare provides disk-level encryption for all stored data.</li>
              <li><strong>Authentication:</strong> We use HMAC-signed session tokens with automatic rotation. Sessions expire after 7 days.</li>
              <li><strong>Access control:</strong> Every message endpoint verifies your membership in the conversation before returning data.</li>
            </ul>

            <h3 className="text-lg font-bold mb-3">4.3 Important Limitations</h3>
            <p className="mb-4">
              <strong>BatchUp does not implement end-to-end encryption.</strong> This means:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li>Message content is stored as plaintext on our servers</li>
              <li>Our server infrastructure can access message content</li>
              <li>Law enforcement may be able to access message content with valid legal process</li>
            </ul>
            <p>
              This is the same security model used by most chat platforms including Slack, Discord, and Telegram (non-secret chats). If you require end-to-end encryption, we recommend using a dedicated encrypted messaging service for sensitive communications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">5. Data Sharing and Disclosure</h2>
            <p className="mb-4">We do not sell your personal information. We may share your data in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li><strong>Service providers:</strong> We use Cloudflare (infrastructure), Google (authentication), and Razorpay (payments) as third-party service providers. Each operates under their own privacy policies.</li>
              <li><strong>Conversation members:</strong> Your name, profile picture, and role are visible to other members of conversations you belong to.</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law, regulation, or valid legal process.</li>
              <li><strong>Security:</strong> We may access data to investigate security incidents or violations of our Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">6. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li><strong>Messages:</strong> Retained indefinitely until deleted by you or a conversation administrator.</li>
              <li><strong>Account data:</strong> Retained until you delete your account.</li>
              <li><strong>Session data:</strong> Expires after 7 days of inactivity.</li>
              <li><strong>Online presence:</strong> Ephemeral data, removed within 2 minutes of disconnection.</li>
              <li><strong>Typing indicators:</strong> Ephemeral data, automatically cleared after 10 seconds.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">7. Your Rights</h2>
            <p className="mb-4">Depending on your jurisdiction, you may have the following rights:</p>

            <h3 className="text-lg font-bold mb-3">7.1 Right of Access</h3>
            <p className="mb-4">You may request a copy of all personal data we hold about you, including your messages, profile information, and conversation history.</p>

            <h3 className="text-lg font-bold mb-3">7.2 Right to Erasure (Right to Be Forgotten)</h3>
            <p className="mb-4">You may request deletion of your account and all associated data. Upon deletion:</p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li>Your Google OAuth tokens are immediately destroyed</li>
              <li>Your session tokens are invalidated</li>
              <li>Your profile data is removed from our databases</li>
              <li>Messages you sent remain in conversation history (attributed to a &quot;Deleted User&quot;)</li>
            </ul>

            <h3 className="text-lg font-bold mb-3">7.3 Right to Rectification</h3>
            <p className="mb-4">Since your profile information comes from your Google account, you can update it through Google. Changes will reflect on your next login.</p>

            <h3 className="text-lg font-bold mb-3">7.4 Right to Data Portability</h3>
            <p className="mb-4">You may request your data in a machine-readable format (JSON).</p>

            <h3 className="text-lg font-bold mb-3">7.5 Right to Object</h3>
            <p className="mb-4">You may object to certain processing of your data. However, some data processing is necessary for the Service to function.</p>

            <h3 className="text-lg font-bold mb-3">7.6 How to Exercise Your Rights</h3>
            <p>
              Contact us at{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>{" "}
              to exercise any of these rights. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">8. Cookies</h2>
            <p className="mb-4">We use the following cookies:</p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li><strong>Session cookie:</strong> An httpOnly, secure cookie used to authenticate your session. This cookie is essential for the Service to function.</li>
            </ul>
            <p>
              We do not use tracking cookies, advertising cookies, or third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for children under 13 years of age (or 16 in the European Economic Area). We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child, we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">10. International Data Transfers</h2>
            <p>
              Your data may be processed in countries other than your own, as Cloudflare operates a global edge network. By using the Service, you consent to the transfer of your data to these locations. Cloudflare maintains compliance with GDPR, SOC 2, and other international data protection standards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy on this page with a new &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:
            </p>
            <p className="mt-3">
              <strong>Email:</strong>{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>
            </p>
            <p>
              <strong>Website:</strong>{" "}
              <a href="https://adnanbuilds.online" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                adnanbuilds.online
              </a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
