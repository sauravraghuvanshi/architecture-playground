import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_GENERATED_KEY, AI_HISTORY_KEY, MAX_AI_HISTORY,
  clearAiLocalHistory, readAiLocalHistory, rememberAiPrompt, validateAiHistory,
} from "../lib/ai-local-history.ts";

function store(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const calls = [];
  return {
    entries, calls,
    getItem(key) { calls.push(["get", key]); return entries.get(key) ?? null; },
    setItem(key, value) { calls.push(["set", key]); entries.set(key, value); },
    removeItem(key) { calls.push(["remove", key]); entries.delete(key); },
  };
}

test("history is never written without explicit opt-in, including with existing history", () => {
  const existing = ["Legacy prompt"];
  const storage = store({ [AI_HISTORY_KEY]: JSON.stringify(existing) });
  assert.deepEqual(readAiLocalHistory(() => storage), existing);
  assert.equal(rememberAiPrompt("Private draft", existing), existing);
  assert.equal(rememberAiPrompt("Private draft", existing, false, () => {
    throw new Error("Storage must not even be accessed without consent");
  }), existing);
  assert.deepEqual(storage.calls, [["get", AI_HISTORY_KEY]]);
  assert.equal(storage.entries.get(AI_HISTORY_KEY), JSON.stringify(existing));
});

test("opt-in history trims, deduplicates, orders newest first and caps future writes at ten", () => {
  const history = Array.from({ length: 10 }, (_, index) => `Prompt ${index}`);
  const storage = store();
  const next = rememberAiPrompt("  New prompt  ", history, true, () => storage);
  assert.equal(MAX_AI_HISTORY, 10);
  assert.equal(next.length, 10);
  assert.equal(next[0], "New prompt");
  assert.equal(next.at(-1), "Prompt 8");
  assert.deepEqual(history, Array.from({ length: 10 }, (_, index) => `Prompt ${index}`));
  const duplicate = rememberAiPrompt("Prompt 2", next, true, () => storage);
  assert.equal(duplicate[0], "Prompt 2");
  assert.equal(duplicate.filter((item) => item === "Prompt 2").length, 1);
  assert.deepEqual(JSON.parse(storage.entries.get(AI_HISTORY_KEY)), duplicate);
  assert.deepEqual([...storage.entries.keys()], [AI_HISTORY_KEY]);
});

test("valid legacy history is viewable without rewriting or silently truncating it", () => {
  const legacy = Array.from({ length: 12 }, (_, index) => `Old ${index}`);
  const storage = store({ [AI_HISTORY_KEY]: JSON.stringify(legacy) });
  assert.deepEqual(readAiLocalHistory(() => storage), legacy);
  assert.deepEqual(storage.calls, [["get", AI_HISTORY_KEY]]);
  assert.equal(storage.entries.get(AI_HISTORY_KEY), JSON.stringify(legacy));
  assert.deepEqual(readAiLocalHistory(() => store()), []);
});

test("malformed history is rejected with a visible-action message and is never erased", () => {
  for (const raw of ["", "{broken", "null", "42", '"string"', "{}", "[null]", '["valid",false]', '[""]', '["  "]', '[{"prompt":"x"}]']) {
    const storage = store({ [AI_HISTORY_KEY]: raw });
    assert.throws(() => readAiLocalHistory(() => storage), {
      name: "AiLocalHistoryError", message: /malformed.*not been changed.*Clear AI session/,
    });
    assert.equal(storage.entries.get(AI_HISTORY_KEY), raw);
    assert.deepEqual(storage.calls, [["get", AI_HISTORY_KEY]]);
  }
  assert.throws(() => validateAiHistory(["valid", 7]), { name: "AiLocalHistoryError" });
  assert.throws(() => rememberAiPrompt(" ", [], true, () => store()), /empty AI prompt/);
  assert.throws(() => rememberAiPrompt("New", [null], true, () => store()), /malformed/);
});

test("storage read and write failures propagate without pretending data was saved", () => {
  const denied = () => { throw new Error("Storage access denied"); };
  assert.throws(() => readAiLocalHistory(denied), /Could not read.*Storage access denied/);
  assert.throws(() => readAiLocalHistory(() => ({ getItem: denied })), /Could not read.*Storage access denied/);
  const history = ["Previous"];
  const storage = store({ [AI_HISTORY_KEY]: JSON.stringify(history) });
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  assert.throws(() => rememberAiPrompt("Unsaved", history, true, () => storage), /not remembered.*Quota exceeded/);
  assert.deepEqual(history, ["Previous"]);
  assert.equal(storage.entries.get(AI_HISTORY_KEY), JSON.stringify(history));
});

test("clear removes only local prompt history and the legacy session candidate", () => {
  const preserved = {
    "architecture-playground:graph": '{"nodes":["existing"]}',
    "architecture-playground:diagram-library": "saved diagrams",
    "architecture-playground:comments": "review comments",
    "architecture-playground:versions": "version history",
    "unrelated:storage-key": "keep",
  };
  const local = store({ ...preserved, [AI_HISTORY_KEY]: '["saved"]' });
  const session = store({ ...preserved, [AI_GENERATED_KEY]: '{"nodes":[]}' });
  clearAiLocalHistory(() => local, () => session);
  assert.deepEqual(Object.fromEntries(local.entries), preserved);
  assert.deepEqual(Object.fromEntries(session.entries), preserved);
  assert.deepEqual(local.calls, [["remove", AI_HISTORY_KEY]]);
  assert.deepEqual(session.calls, [["remove", AI_GENERATED_KEY]]);
  clearAiLocalHistory(() => local, () => session);
  assert.deepEqual(Object.fromEntries(local.entries), preserved);
});

test("clear attempts both removals and reports all failures, including storage getter failures", () => {
  for (const failingStore of ["local", "session", "both"]) {
    const local = store({ [AI_HISTORY_KEY]: '["saved"]' });
    const session = store({ [AI_GENERATED_KEY]: "legacy candidate" });
    const getLocal = () => {
      if (failingStore !== "session") throw new Error("Local store denied");
      return local;
    };
    const getSession = () => {
      if (failingStore !== "local") throw new Error("Session store denied");
      return session;
    };
    assert.throws(() => clearAiLocalHistory(getLocal, getSession), (error) => {
      assert.equal(error.name, "AiLocalHistoryError");
      assert.match(error.message, /cleared from memory.*saved AI data could not be removed/);
      if (failingStore !== "session") assert.match(error.message, /Local store denied/);
      if (failingStore !== "local") assert.match(error.message, /Session store denied/);
      return true;
    });
    if (failingStore === "local") assert.equal(session.entries.has(AI_GENERATED_KEY), false);
    if (failingStore === "session") assert.equal(local.entries.has(AI_HISTORY_KEY), false);
  }
  const local = store();
  const session = store();
  local.removeItem = () => { throw new Error("Removal blocked"); };
  assert.throws(() => clearAiLocalHistory(() => local, () => session), /Removal blocked/);
  assert.deepEqual(session.calls, [["remove", AI_GENERATED_KEY]]);
});
