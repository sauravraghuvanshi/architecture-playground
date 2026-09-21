export const AI_HISTORY_KEY = "architecture-playground:ai-history";
export const AI_GENERATED_KEY = "architecture-playground:ai-generated";
export const MAX_AI_HISTORY = 10;

type HistoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorageAccess = () => HistoryStorage;

export class AiLocalHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiLocalHistoryError";
  }
}

function storageMessage(action: string, cause: unknown) {
  return new AiLocalHistoryError(
    `${action}. ${cause instanceof Error ? cause.message : "Browser storage is unavailable."}`,
  );
}

export function validateAiHistory(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new AiLocalHistoryError("Saved AI prompt history is malformed. It has not been changed; use Clear AI session to remove it.");
  }
  return [...value];
}

export function readAiLocalHistory(getStorage: StorageAccess = () => window.localStorage): string[] {
  let raw: string | null;
  try {
    raw = getStorage().getItem(AI_HISTORY_KEY);
  } catch (cause) {
    throw storageMessage("Could not read saved AI prompt history", cause);
  }
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiLocalHistoryError("Saved AI prompt history is malformed. It has not been changed; use Clear AI session to remove it.");
  }
  return validateAiHistory(parsed);
}

export function rememberAiPrompt(
  prompt: string,
  history: string[],
  remember = false,
  getStorage: StorageAccess = () => window.localStorage,
): string[] {
  if (!remember) return history;
  const validated = validateAiHistory(history);
  const trimmed = prompt.trim();
  if (!trimmed) throw new AiLocalHistoryError("An empty AI prompt cannot be saved.");
  const next = [...new Set([trimmed, ...validated])].slice(0, MAX_AI_HISTORY);
  try {
    getStorage().setItem(AI_HISTORY_KEY, JSON.stringify(next));
  } catch (cause) {
    throw storageMessage("Could not save AI prompt history; this prompt was not remembered", cause);
  }
  return next;
}

export function clearAiLocalHistory(
  getLocalStorage: StorageAccess = () => window.localStorage,
  getSessionStorage: StorageAccess = () => window.sessionStorage,
): void {
  const failures: string[] = [];
  // Attempt both scoped removals even if one store is blocked.
  for (const [access, key] of [
    [getLocalStorage, AI_HISTORY_KEY],
    [getSessionStorage, AI_GENERATED_KEY],
  ] as const) {
    try {
      access().removeItem(key);
    } catch (cause) {
      failures.push(storageMessage(`Could not remove ${key}`, cause).message);
    }
  }
  if (failures.length) {
    throw new AiLocalHistoryError(`The AI session was cleared from memory, but some saved AI data could not be removed. ${failures.join(" ")}`);
  }
}
