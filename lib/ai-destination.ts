/** Server-configured origins only; never accept endpoint values from a request. */
export function configuredAiOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const localDevelopment = process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol === "http:";
    if ((!localDevelopment && url.protocol !== "https:") ||
        url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch { return null; }
}
