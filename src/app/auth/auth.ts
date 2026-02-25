export type AuthUser = {
  id: string;
  name: string;
  email: string;
  organization: string;
};

type StoredUser = AuthUser & { password: string };

const USERS_KEY = "pulseforge_users";
const SESSION_KEY = "pulseforge_session";

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toPublicUser(user: StoredUser): AuthUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function registerUser(input: {
  name: string;
  email: string;
  organization: string;
  password: string;
}): { ok: true; user: AuthUser } | { ok: false; message: string } {
  const users = readUsers();
  const email = input.email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === email)) {
    return { ok: false, message: "This email is already registered." };
  }

  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    organization: input.organization.trim(),
    password: input.password,
  };

  users.push(user);
  writeUsers(users);

  const sessionUser = toPublicUser(user);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { ok: true, user: sessionUser };
}

export function loginUser(input: {
  email: string;
  password: string;
}): { ok: true; user: AuthUser } | { ok: false; message: string } {
  const users = readUsers();
  const email = input.email.trim().toLowerCase();
  const user = users.find((record) => record.email.toLowerCase() === email);

  if (!user || user.password !== input.password) {
    return { ok: false, message: "Invalid email or password." };
  }

  const sessionUser = toPublicUser(user);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { ok: true, user: sessionUser };
}
