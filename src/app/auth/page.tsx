"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, loginUser, registerUser } from "./auth";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantLogoData, setTenantLogoData] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(() => (mode === "login" ? "Welcome back" : "Create your workspace"), [mode]);
  const heroImage =
    mode === "login"
      ? "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80"
      : "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=80";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result =
      mode === "login"
        ? await loginUser({ email, password })
        : await registerUser({ tenantSlug, tenantName, tenantLogoData, name, email, password });

    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/");
  }

  async function onForgotPassword() {
    setError("");
    setForgotMessage("");
    if (!email.trim()) {
      setError("Enter email first.");
      return;
    }

    setForgotLoading(true);
    const result = await forgotPassword({ email, tenantSlug: tenantSlug || "" });
    setForgotLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setForgotMessage(result.message);
  }

  async function onPickLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo file is too large. Max size is 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setError("Failed to read logo image.");
        return;
      }
      setTenantLogoData(result);
      setError("");
    };
    reader.onerror = () => setError("Failed to load logo image.");
    reader.readAsDataURL(file);
  }

  return (
    <main className="min-h-screen bg-slate-900 p-4 text-slate-900 md:p-8">
      <div className="mx-auto grid min-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
        <section
          className="relative hidden lg:block"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(2,6,23,0.68), rgba(15,23,42,0.5)), url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-100">{mode === "login" ? "Secure Access" : "New Organization"}</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">PulseForge Admin Workspace</h2>
            <p className="mt-3 max-w-md text-sm text-slate-200">
              {mode === "login"
                ? "Sign in to continue managing projects, analytics, and tenant operations."
                : "Register your organization with logo branding and start onboarding your team."}
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white p-6 md:p-10">
          <form onSubmit={onSubmit} className="w-full max-w-md">
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-lg px-3 py-2 ${mode === "login" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-lg px-3 py-2 ${mode === "register" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                Register
              </button>
            </div>

            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {mode === "login" ? "Enter your organization slug and account credentials." : "Use a unique organization name and a unique email."}
            </p>

            {mode === "register" ? (
              <>
                <label className="mt-5 block text-sm font-medium text-slate-700">Organization Slug</label>
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(event.target.value)}
                  required
                  placeholder="acme"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
                />

                <label className="mt-4 block text-sm font-medium text-slate-700">Organization Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(event) => setTenantName(event.target.value)}
                  required
                  placeholder="Acme Incorporated"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
                />

                <label className="mt-4 block text-sm font-medium text-slate-700">Organization Logo Upload</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void onPickLogo(event.target.files?.[0] || null)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
                />
                {tenantLogoData.trim() ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <img src={tenantLogoData} alt="Organization logo preview" className="h-10 w-10 rounded-md object-cover" />
                    <p className="text-xs text-slate-600">Logo preview</p>
                    <button
                      type="button"
                      onClick={() => setTenantLogoData("")}
                      className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <label className="mt-4 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
                />
              </>
            ) : null}

            <label className="mt-4 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />

            <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />

            {mode === "login" ? (
              <button
                type="button"
                onClick={onForgotPassword}
                disabled={forgotLoading}
                className="mt-2 text-sm font-medium text-sky-700 hover:text-sky-800 disabled:opacity-60"
              >
                {forgotLoading ? "Sending reset..." : "Forgot password?"}
              </button>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            {forgotMessage ? <p className="mt-3 text-sm text-emerald-700">{forgotMessage}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
