"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, loginUser, registerUser } from "./auth";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [tenantSlug, setTenantSlug] = useState("acme");
  const [tenantName, setTenantName] = useState("Acme Inc");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(() => (mode === "login" ? "Login" : "Create Account"), [mode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result =
      mode === "login"
        ? await loginUser({ tenantSlug, email, password })
        : await registerUser({ tenantSlug, tenantName, name, email, password });

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
    if (!tenantSlug.trim() || !email.trim()) {
      setError("Enter tenant slug and email first.");
      return;
    }

    setForgotLoading(true);
    const result = await forgotPassword({ tenantSlug, email });
    setForgotLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setForgotMessage(result.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 ${mode === "login" ? "bg-white font-semibold text-slate-900" : "text-slate-600"}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-md px-3 py-2 ${mode === "register" ? "bg-white font-semibold text-slate-900" : "text-slate-600"}`}
          >
            Register
          </button>
        </div>

        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

        <label className="mt-4 block text-sm font-medium text-slate-700">Tenant Slug</label>
        <input
          type="text"
          value={tenantSlug}
          onChange={(event) => setTenantSlug(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
        />

        {mode === "register" ? (
          <>
            <label className="mt-4 block text-sm font-medium text-slate-700">Tenant Name</label>
            <input
              type="text"
              value={tenantName}
              onChange={(event) => setTenantName(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
            />

            <label className="mt-4 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
            />
          </>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
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
          className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </main>
  );
}
