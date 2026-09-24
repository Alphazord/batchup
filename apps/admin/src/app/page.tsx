"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { testApiKey } from "@/lib/api";
import { getAdminKey, setAdminKey } from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const existing = getAdminKey();
    if (existing) {
      router.replace("/overview");
    } else {
      setLoading(false);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTesting(true);

    const valid = await testApiKey(key);
    if (valid) {
      setAdminKey(key);
      router.push("/overview");
    } else {
      setError("Invalid API key");
    }
    setTesting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cobalt/8 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-marker/8 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="rounded-xl border border-ridge bg-ink p-8 border-t-2 border-t-cobalt">
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cobalt to-online flex items-center justify-center shadow-lg shadow-cobalt/25">
                <span className="font-display font-bold text-sm text-void">B</span>
              </div>
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-online border-2 border-ink" style={{ animation: "pulse-glow 2s ease-in-out infinite" }} />
            </div>
            <h1 className="font-display text-2xl font-bold text-paper tracking-tight">BatchUp Admin</h1>
            <p className="text-dim text-sm mt-1.5">Enter your admin API key to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="api-key" className="block text-[11px] text-faint uppercase tracking-wider font-semibold mb-1.5">
                API Key
              </label>
              <input
                id="api-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-admin-..."
                className="w-full px-4 py-3 rounded-lg bg-void border border-ridge text-paper placeholder:text-faint text-sm font-mono focus:outline-none focus:border-cobalt focus:ring-1 focus:ring-cobalt/30 transition-all"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-marker text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={testing || !key}
              className="w-full py-3 rounded-lg bg-cobalt text-void font-semibold text-sm hover:bg-cobalt-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-display tracking-tight"
            >
              {testing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
