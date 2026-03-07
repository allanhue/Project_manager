"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AuthUser, getUserProfile, updateCurrentUser, updateUserProfile, UserProfile } from "../auth/auth";

type ProfilePageProps = {
  user: AuthUser;
};

const defaultProfile: UserProfile = {
  display_name: "",
  phone: "",
  organization_name: "",
  town: "",
  logo_url: "",
  max_sessions: 0,
  active_sessions_24h: 0,
};

export default function ProfilePage({ user }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await getUserProfile();
        if (!mounted) return;
        setProfile({ ...defaultProfile, ...payload, display_name: payload.display_name || user.name });
      } catch {
        if (!mounted) return;
        setProfile((prev) => ({ ...prev, display_name: user.name }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user.name]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus("Saving profile...");
    try {
      await updateUserProfile(profile);
      updateCurrentUser({ name: profile.display_name || user.name });
      setStatus("Profile updated.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function onLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setProfile((prev) => ({ ...prev, logo_url: value }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-600">Manage identity, logo, contact details and organization profile information.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onSave} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">User & Organization Details</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Display Name</label>
              <input type="text" value={profile.display_name} onChange={(event) => setProfile((prev) => ({ ...prev, display_name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
              <input type="text" value={profile.phone} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} placeholder="+2547..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Organization Name</label>
              <input type="text" value={profile.organization_name} onChange={(event) => setProfile((prev) => ({ ...prev, organization_name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Town / City</label>
              <input type="text" value={profile.town} onChange={(event) => setProfile((prev) => ({ ...prev, town: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Organization Logo</label>
              <input type="file" accept="image/*" onChange={onLogoUpload} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none" />
            </div>
            <button type="submit" disabled={saving} className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-500">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : null}
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {status ? <p className="text-sm text-slate-600">{status}</p> : null}
          </div>
        </form>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Account Snapshot</h3>
          <dl className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt>Email</dt><dd className="font-medium text-slate-900">{user.email}</dd></div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt>User ID</dt><dd className="font-medium text-slate-900">{user.id}</dd></div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt>Organization Slug</dt><dd className="font-medium text-slate-900">{user.tenantSlug}</dd></div>
            <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt>Organization Name</dt><dd className="font-medium text-slate-900">{user.tenantName || profile.organization_name || "-"}</dd></div>
            {user.role === "org_admin" ? (
              <>
                <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt>Active Sessions (24h)</dt><dd className="font-medium text-slate-900">{profile.active_sessions_24h || 0}</dd></div>
                <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><dt>Allowed Sessions</dt><dd className="font-medium text-slate-900">{profile.max_sessions || 5}</dd></div>
              </>
            ) : null}
          </dl>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Logo Preview</p>
            {profile.logo_url ? <img src={profile.logo_url} alt="Organization logo" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" /> : <p className="text-sm text-slate-500">No logo uploaded.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
