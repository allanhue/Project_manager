"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { registerUser } from "./auth";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const result = registerUser({ name, organization, email, password });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Create Account</h1>
        <p className="mt-1 text-sm text-slate-600">Start managing projects and activities.</p>

        <label className="mt-5 block text-sm font-medium text-slate-700">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">Organization</label>
        <input
          type="text"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300"
        />

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

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <button type="submit" className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Create Account
        </button>

        <p className="mt-4 text-sm text-slate-600">
          Already registered?{" "}
          <Link href="/auth/login" className="font-medium text-sky-700">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
