import { createSeedState, normalizeAppState, type AppState } from "@orbital/domain";

import {
  applyStoredProviderSecretsToState,
  persistProviderSecrets,
  stripProviderSecretsFromState
} from "./providerSecretStore.ts";

const STORAGE_KEY = "orbital-state-v1";

export const loadAppState = (): AppState => {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createSeedState();
  }

  try {
    return applyStoredProviderSecretsToState(normalizeAppState(JSON.parse(raw) as AppState));
  } catch {
    return createSeedState();
  }
};

export const saveAppState = (state: AppState) => {
  const normalized = normalizeAppState(state);
  persistProviderSecrets(normalized.providers);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(stripProviderSecretsFromState(normalized))
  );
};
