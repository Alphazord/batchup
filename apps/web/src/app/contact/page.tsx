import type { Metadata } from "next";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Contact — BatchUp",
  description: "Get in touch with the BatchUp team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-ink-1 text-paper">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">Contact</h1>
        <p className="text-paper-dim text-sm mb-8">We&apos;d like to hear from you</p>

        <div className="space-y-10 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">General Inquiries</h2>
            <p>
              For general questions, feedback, or partnership inquiries, reach out to us at{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Support</h2>
            <p>
              Having trouble with BatchUp? Email us at{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>{" "}
              with a description of the issue. Include your account email and a screenshot if possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Security Issues</h2>
            <p>
              Found a security vulnerability? Please report it responsibly by emailing{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>
              . Do not open public GitHub issues for security vulnerabilities. We aim to respond within 48 hours.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Data Requests</h2>
            <p>
              To exercise your data rights (access, deletion, portability), email{" "}
              <a href="mailto:adnan@adnanbuilds.online" className="text-highlighter hover:underline">
                adnan@adnanbuilds.online
              </a>{" "}
              with the subject line &quot;Data Request&quot; and specify what you need. We respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold font-display mb-4 mt-10">Elsewhere</h2>
            <ul className="space-y-3">
              <li>
                <span className="text-paper-dim">GitHub:</span>{" "}
                <a href="https://github.com/buildbyadnan" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                  github.com/buildbyadnan
                </a>
              </li>
              <li>
                <span className="text-paper-dim">Website:</span>{" "}
                <a href="https://adnanbuilds.online" target="_blank" rel="noopener noreferrer" className="text-highlighter hover:underline">
                  adnanbuilds.online
                </a>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
