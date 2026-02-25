export type AuthUser = {
  id: string;
  name: string;
  email: string;
  tenantSlug: string;
  tenantName?: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const SESSION_KEY = "pulseforge_session";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

type RegisterInput = {
  tenantSlug: string;
  tenantName: string;
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  tenantSlug: string;
  email: string;
  password: string;
};

export type Project = {
  id: number;
  tenant_id: string;
  name: string;
  status: string;
  created_at: string;
};

function parseJwtClaims(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function userFromToken(token: string): AuthUser {
  const claims = parseJwtClaims(token);
  const email = String(claims.email || "");
  const tenantSlug = String(claims.tenant_id || "");
  const id = String(claims.sub || "");
  const nameFromEmail = email.includes("@") ? email.split("@")[0] : "User";
  return {
    id,
    email,
    tenantSlug,
    name: nameFromEmail,
  };
}

export function getSession(): AuthSession | null {
  return readSession();
}

export function getCurrentUser(): AuthUser | null {
  return readSession()?.user || null;
}

export function getAuthToken(): string | null {
  return readSession()?.token || null;
}

export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export async function registerUser(input: RegisterInput): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  try {
    const payload = await requestJSON<{
      token: string;
      user: { id: number; name: string; email: string; tenant_slug: string };
    }>("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_slug: input.tenantSlug,
        tenant_name: input.tenantName,
        name: input.name,
        email: input.email,
        password: input.password,
      }),
    });

    const user: AuthUser = {
      id: String(payload.user.id),
      name: payload.user.name,
      email: payload.user.email,
      tenantSlug: payload.user.tenant_slug,
      tenantName: input.tenantName,
    };
    writeSession({ token: payload.token, user });
    return { ok: true, user };
  } catch (error) {
    return { ok: false, message: normalizeError(error) };
  }
}

export async function loginUser(input: LoginInput): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  try {
    const payload = await requestJSON<{ token: string }>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_slug: input.tenantSlug,
        email: input.email,
        password: input.password,
      }),
    });

    const user = userFromToken(payload.token);
    writeSession({ token: payload.token, user });
    return { ok: true, user };
  } catch (error) {
    return { ok: false, message: normalizeError(error) };
  }
}

export async function listProjects(): Promise<Project[]> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  const payload = await requestJSON<{ items: Project[] }>("/api/v1/projects", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return payload.items || [];
}

export async function createProject(input: { name: string; status?: string }): Promise<Project> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<Project>("/api/v1/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}
