"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar } from "./avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field-label";

export function ProfileTab() {
  const { user, loading, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when user data changes (e.g. after successful update)
  useEffect(() => {
    if (!editing) {
      setName(user?.name ?? "");
      setUsername(user?.username ?? "");
    }
  }, [user?.name, user?.username, editing]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ink">
        <div className="w-6 h-6 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const handleSave = async () => {
    if (!name.trim() || !username.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateUser({ name: name.trim(), username: username.trim() });
      setEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user.name);
    setUsername(user.username);
    setEditing(false);
    setError(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-ink overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b-[2.5px] border-ink-3">
        <h2 className="font-display font-700 text-[18px] text-paper">Profile</h2>
      </div>

      {/* Avatar + Info */}
      <div className="flex flex-col items-center px-5 pt-8 pb-6">
        <Avatar name={user.name} picture={user.picture} size="xl" />
        {!editing && (
          <>
            <div className="mt-4 font-display font-700 text-[18px] text-paper">{user.name}</div>
            <div className="mt-1 font-mono text-[12px] text-paper-faint">@{user.username}</div>
            <div className="mt-1 text-[12px] text-paper-faint">{user.email}</div>
          </>
        )}
      </div>

      {/* Edit Form or Edit Button */}
      <div className="px-5 pb-6">
        {editing ? (
          <div className="flex flex-col gap-4">
            {error && (
              <div className="text-[13px] text-signal bg-signal/10 border-[2.5px] border-signal/30 rounded-[14px] px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <FieldLabel>Username</FieldLabel>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                placeholder="username"
              />
              <span className="mt-1 block font-mono text-[10px] text-paper-faint">
                Lowercase letters, numbers, dots, underscores
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button variant="ghost" fullWidth onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={handleSave}
                disabled={saving || !name.trim() || !username.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" fullWidth onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {/* Logout */}
      <div className="px-5 pb-8">
        <Button variant="danger" fullWidth onClick={logout}>
          Log Out
        </Button>
      </div>
    </div>
  );
}
