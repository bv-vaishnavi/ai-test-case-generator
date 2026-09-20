export interface User {
  id: string;
  name: string;
  email: string;
}
export function currentUser(): User | null {
  try {
    const value = JSON.parse(sessionStorage.getItem("user") || "null");
    return value &&
      typeof value.name === "string" &&
      typeof value.email === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function clearSession() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}
export function tokenExpiresAt(): number | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}
export function hasValidSession() {
  const expiresAt = tokenExpiresAt();
  return expiresAt !== null && expiresAt > Date.now();
}
export function saveSession(data: { token: string; user: User }) {
  sessionStorage.setItem("token", data.token);
  sessionStorage.setItem("user", JSON.stringify(data.user));
}
