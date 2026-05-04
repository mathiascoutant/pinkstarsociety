/** Évite les redirections ouvertes (open redirect). */
export function safeInternalPath(path: string | null): string | null {
  if (path == null) return null;
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  return p;
}
