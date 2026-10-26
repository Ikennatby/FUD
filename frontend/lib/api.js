const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function getAuth() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("fud_auth")); } catch { return null; }
}
export function setAuth(auth) {
  if (auth) localStorage.setItem("fud_auth", JSON.stringify(auth));
  else localStorage.removeItem("fud_auth");
}

// body can be a plain object (sent as JSON) or a FormData (used for picture uploads).
export async function api(path, { method = "GET", body } = {}) {
  const auth = getAuth();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isForm ? {} : { "Content-Type": "application/json" };
  if (auth?.access) headers.Authorization = `Bearer ${auth.access}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw new Error("Can't reach the server. Make sure the backend is running.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth && path !== "/login/") {
    setAuth(null);
    if (method === "GET") return api(path); // public pages still work as a guest
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!res.ok) throw new Error(data.error || data.detail || "Something went wrong. Try again.");
  return data;
}

export const naira = (n) => `₦${Number(n).toLocaleString()}`;

// Uploaded pictures come back as "/media/..."; this turns that into a full address on the backend.
export const media = (u) => (!u ? "" : /^https?:/.test(u) ? u : BASE.replace(/\/api\/?$/, "") + u);

export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;