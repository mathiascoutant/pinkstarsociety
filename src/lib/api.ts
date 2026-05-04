const getToken = () => localStorage.getItem("pss_token");

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const t = getToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`/api${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("pss_token", token);
  else localStorage.removeItem("pss_token");
}
