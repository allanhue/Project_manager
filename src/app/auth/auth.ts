export type AuthUser = {
  id: string;
  name: string;
  email: string;
  tenantSlug: string;
  tenantName?: string;
  role: "system_admin" | "org_admin";
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

type ForgotPasswordInput = {
  tenantSlug: string;
  email: string;
};

export type Project = {
  id: number;
  tenant_id: string;
  name: string;
  status: string;
  created_at: string;
};

export type TaskItem = {
  id: number;
  tenant_id: string;
  project_id?: number | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

export type SystemOrganization = {
  tenant_slug: string;
  tenant_name: string;
  user_count: number;
  project_count: number;
  task_count: number;
  active_users_7d: number;
  last_login_at?: string | null;
  active_workspace_7d: boolean;
};

export type SystemAnalytics = {
  tenant_count: number;
  user_count: number;
  project_count: number;
  task_count: number;
  active_users_24h: number;
  active_users_7d: number;
  active_tenants_7d: number;
};

export type SystemLog = {
  id: number;
  tenant_slug: string;
  user_email: string;
  role: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
};

export type SystemTenant = {
  id: number;
  slug: string;
  name: string;
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
  const tenantName = String(claims.tenant_name || "");
  const id = String(claims.sub || "");
  const role = String(claims.role || "org_admin") as "system_admin" | "org_admin";
  const nameFromEmail = email.includes("@") ? email.split("@")[0] : "User";
  return {
    id,
    email,
    tenantSlug,
    tenantName,
    role,
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

export function updateCurrentUser(patch: Partial<Pick<AuthUser, "name">>) {
  const session = readSession();
  if (!session) return;
  const nextUser: AuthUser = {
    ...session.user,
    ...patch,
    name: (patch.name ?? session.user.name).trim() || session.user.name,
  };
  writeSession({ ...session, user: nextUser });
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
      role: (payload.user as { role?: "system_admin" | "org_admin" }).role || "org_admin",
    };
    writeSession({ token: payload.token, user });
    return { ok: true, user };
  } catch (error) {
    return { ok: false, message: normalizeError(error) };
  }
}

export async function loginUser(input: LoginInput): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> {
  try {
    const payload = await requestJSON<{
      token: string;
      user?: { name?: string; tenant_name?: string; role?: "system_admin" | "org_admin" };
    }>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_slug: input.tenantSlug,
        email: input.email,
        password: input.password,
      }),
    });

    const user = userFromToken(payload.token);
    if (payload.user?.name) user.name = payload.user.name;
    if (payload.user?.tenant_name) user.tenantName = payload.user.tenant_name;
    if (payload.user?.role) user.role = payload.user.role;
    writeSession({ token: payload.token, user });
    return { ok: true, user };
  } catch (error) {
    return { ok: false, message: normalizeError(error) };
  }
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const payload = await requestJSON<{ status?: string; message?: string }>("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_slug: input.tenantSlug,
        email: input.email,
      }),
    });
    return { ok: true, message: payload.status || "If the account exists, a reset email has been sent." };
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

export async function listTasks(): Promise<TaskItem[]> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  const payload = await requestJSON<{ items: TaskItem[] }>("/api/v1/tasks", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return payload.items || [];
}

export async function createTask(input: { title: string; status?: string; priority?: string; project_id?: number | null }): Promise<TaskItem> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<TaskItem>("/api/v1/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function getSystemOrganizations(): Promise<SystemOrganization[]> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  const payload = await requestJSON<{ items: SystemOrganization[] }>("/api/v1/system/organizations", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return payload.items || [];
}

export async function getSystemAnalytics(): Promise<SystemAnalytics> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<SystemAnalytics>("/api/v1/system/analytics", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSystemLogs(limit = 100): Promise<SystemLog[]> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  const payload = await requestJSON<{ items: SystemLog[] }>(`/api/v1/system/logs?limit=${limit}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return payload.items || [];
}

export async function getSystemTenants(): Promise<SystemTenant[]> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  const payload = await requestJSON<{ items: SystemTenant[] }>("/api/v1/system/tenants", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return payload.items || [];
}

export async function createSystemTenant(input: { slug: string; name: string }): Promise<SystemTenant> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<SystemTenant>("/api/v1/system/tenants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function updateSystemTenant(input: { id: number; slug: string; name: string }): Promise<SystemTenant> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<SystemTenant>(`/api/v1/system/tenants/${input.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slug: input.slug, name: input.name }),
  });
}

export async function sendTestNotification(input?: { email?: string; subject?: string; message?: string }): Promise<{ status: string }> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<{ status: string }>("/api/v1/notifications/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input || {}),
  });
}

export async function sendSupportRequest(input: { subject: string; message: string; priority?: string }): Promise<{ status: string }> {
  const token = getAuthToken();
  if (!token) throw new Error("Please login first.");
  return requestJSON<{ status: string }>("/api/v1/support/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}
