import assert from "node:assert/strict";
import test from "node:test";

import { createSeedState } from "@orbital/domain";

import { loadAppState, saveAppState } from "./localStore.ts";

class MemoryStorage {
  #store = new Map<string, string>();

  getItem(key: string) {
    return this.#store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.#store.set(key, value);
  }

  removeItem(key: string) {
    this.#store.delete(key);
  }

  clear() {
    this.#store.clear();
  }
}

const installWindow = () => {
  const localStorage = new MemoryStorage();
  Object.assign(globalThis, {
    window: { localStorage }
  });
  return localStorage;
};

test("saveAppState strips provider secrets from persisted app state", () => {
  const localStorage = installWindow();
  const state = createSeedState();
  const provider = state.providers[0];

  provider.apiKey = "sk-live-test";
  provider.extraHeaders = [{ key: "x-org-token", value: "org-secret" }];

  saveAppState(state);

  const storedState = JSON.parse(localStorage.getItem("orbital-state-v1") || "{}");
  assert.equal(storedState.providers[0].apiKey, "");
  assert.deepEqual(storedState.providers[0].extraHeaders, []);

  const storedSecrets = JSON.parse(localStorage.getItem("orbital-provider-secrets-v1") || "{}");
  assert.equal(storedSecrets[provider.id].apiKey, "sk-live-test");
  assert.deepEqual(storedSecrets[provider.id].extraHeaders, [
    { key: "x-org-token", value: "org-secret" }
  ]);
});

test("loadAppState rehydrates provider secrets from the secret store", () => {
  const localStorage = installWindow();
  const state = createSeedState();
  const provider = state.providers[0];

  provider.apiKey = "sk-deepseek";
  provider.extraHeaders = [{ key: "x-provider", value: "deepseek" }];

  saveAppState(state);

  const loaded = loadAppState();
  assert.equal(loaded.providers[0].apiKey, "sk-deepseek");
  assert.deepEqual(loaded.providers[0].extraHeaders, [
    { key: "x-provider", value: "deepseek" }
  ]);
});
