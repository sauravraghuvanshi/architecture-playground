export function safeReturnPath(requested: string | null | undefined): string {
  if (!requested || !/^\/[^/\\]/.test(requested)) return "/";
  try {
    const base = new URL("https://diagrammatic.invalid");
    const destination = new URL(requested, base);
    return destination.origin === base.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/";
  } catch {
    return "/";
  }
}
