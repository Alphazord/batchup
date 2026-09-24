"use client";

import { useAuth } from "@/contexts/auth-context";
import { Modal } from "./modal";
import { GoogleButton } from "./google-button";

export function SignupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, loading, logout } = useAuth();

  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center">
        <h2 id="modal-title" className="text-2xl font-bold text-paper mb-2">
          {user ? "Welcome back" : "Get started"}
        </h2>
        <p className="text-paper-dim mb-6">
          {user ? `Signed in as ${user.email}` : "Create your account in seconds"}
        </p>

        {loading ? (
          <div className="py-3 text-paper-faint">Loading...</div>
        ) : user ? (
          <div className="space-y-3">
            {user.picture && (
              <img
                src={user.picture}
                alt=""
                className="w-12 h-12 rounded-full mx-auto"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <button
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="w-full py-3 rounded-full bg-ink-3 text-paper font-medium hover:bg-ink-4 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <GoogleButton />
        )}
      </div>
    </Modal>
  );
}
