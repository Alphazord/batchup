import type { Metadata } from "next";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Terms of Service — BatchUp",
  description: "Terms and conditions for using BatchUp.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ink-1 text-paper">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">Terms of Service</h1>
        <p className="text-paper-dim text-sm mb-8">Last updated: August 2, 2026</p>

        <div className="space-y-10 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing or using BatchUp (the &quot;Service&quot;) at{" "}
              <a href="https://batchup.fun" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                batchup.fun
              </a>
              , you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you and AdnanBuilds, the operator of BatchUp.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">2. Description of Service</h2>
            <p className="mb-4">
              BatchUp is a real-time group chat platform that provides:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Direct messaging between users</li>
              <li>Group chat conversations with up to 5,000 members</li>
              <li>Real-time message delivery via WebSockets</li>
              <li>Message reactions, replies, and editing</li>
              <li>Role-based access control (owner, admin, member)</li>
              <li>Configurable rate limiting per conversation</li>
              <li>Online presence and typing indicators</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">3. Eligibility</h2>
            <p className="mb-4">To use the Service, you must:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Be at least 13 years old (or the minimum age in your jurisdiction)</li>
              <li>Have the capacity to enter into a binding agreement</li>
              <li>Not be barred from using the Service under applicable law</li>
              <li>Have a valid Google account for authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">4. Account and Authentication</h2>
            <h3 className="text-lg font-bold mb-3">4.1 Google OAuth</h3>
            <p className="mb-4">
              The Service uses Google OAuth for authentication. You must have a valid Google account to use BatchUp. Your account is linked to your Google profile, and your name, email, and profile picture are used within the Service.
            </p>
            <h3 className="text-lg font-bold mb-3">4.2 Account Security</h3>
            <p className="mb-4">
              You are responsible for all activity that occurs under your account. You must not share your session credentials with others. If you believe your account has been compromised, contact us immediately.
            </p>
            <h3 className="text-lg font-bold mb-3">4.3 One Account Per Person</h3>
            <p>
              Each person may maintain only one BatchUp account. Creating multiple accounts to evade bans, rate limits, or moderation actions is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">5. Acceptable Use Policy</h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Harass, threaten, bully, or intimidate other users</li>
              <li>Post hate speech, discriminatory content, or content that promotes violence</li>
              <li>Send spam, phishing messages, or unsolicited advertisements</li>
              <li>Share illegal, obscene, or sexually explicit content</li>
              <li>Impersonate another person or entity</li>
              <li>Share content that violates the intellectual property rights of others</li>
              <li>Attempt to gain unauthorized access to other accounts, conversations, or systems</li>
              <li>Use the Service to distribute malware or harmful code</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Use automated tools (bots, scrapers) to access the Service without written permission</li>
              <li>Evade or circumvent rate limits, bans, or other restrictions</li>
              <li>Engage in any activity that violates applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">6. Content</h2>
            <h3 className="text-lg font-bold mb-3">6.1 Your Content</h3>
            <p className="mb-4">
              You retain ownership of all messages, reactions, and other content you submit to the Service (&quot;Your Content&quot;). By submitting Your Content, you grant AdnanBuilds a worldwide, non-exclusive, royalty-free license to store, display, and transmit Your Content solely for the purpose of operating and providing the Service.
            </p>
            <h3 className="text-lg font-bold mb-3">6.2 Content Moderation</h3>
            <p className="mb-4">
              BatchUp provides administrators with moderation tools including member removal and rate limiting. We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
            <h3 className="text-lg font-bold mb-3">6.3 No End-to-End Encryption</h3>
            <p>
              The Service does not provide end-to-end encryption. Messages are stored as plaintext on our servers. You should not use the Service for highly sensitive communications that require end-to-end encryption.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">7. Group Administrators</h2>
            <p className="mb-4">
              Group owners and administrators have additional capabilities:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-6 pl-4">
              <li>Add or remove members from the group</li>
              <li>Assign and revoke admin roles</li>
              <li>Configure rate limit tiers for the group</li>
              <li>Delete messages from any member</li>
              <li>Access message search within their group</li>
            </ul>
            <p>
              Administrators are responsible for the conduct of their group members and for enforcing these Terms within their group.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">8. Payments</h2>
            <p className="mb-4">
              The Service may offer paid features processed through Razorpay. By making a payment:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>You agree to Razorpay&apos;s terms of service and privacy policy</li>
              <li>All payments are processed in Indian Rupees (INR) unless otherwise specified</li>
              <li>Refund requests must be made within 7 days of purchase by contacting adnan@adnanbuilds.online</li>
              <li>We reserve the right to change pricing with 30 days&apos; notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">9. Intellectual Property</h2>
            <p className="mb-4">
              The Service, including its code, design, branding, and documentation, is the intellectual property of AdnanBuilds. You may not copy, modify, distribute, or reverse-engineer any part of the Service without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">10. Termination</h2>
            <h3 className="text-lg font-bold mb-3">10.1 By You</h3>
            <p className="mb-4">
              You may delete your account at any time through the Service settings. Account deletion removes your profile data and invalidates your session. Messages you sent remain in conversation history.
            </p>
            <h3 className="text-lg font-bold mb-3">10.2 By Us</h3>
            <p>
              We may suspend or terminate your access to the Service at our discretion, with or without notice, for conduct that violates these Terms or is otherwise harmful to the Service or its users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">11. Disclaimers</h2>
            <p className="mb-4">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mb-4">
              We do not warrant that the Service will be uninterrupted, error-free, or secure. The Service depends on third-party infrastructure (Cloudflare, Google, Razorpay) and may be affected by their availability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ADNANBUILDS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">13. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless AdnanBuilds and its operators from any claims, losses, damages, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">14. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page with a revised &quot;Last updated&quot; date. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">15. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the courts of India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">16. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">17. Contact</h2>
            <p>
              For questions about these Terms, contact us at:
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
