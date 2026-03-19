import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProviderSecretsToState,
  extractProviderSecretPayload,
  hasProviderSecretPayload,
  stripProviderSecretsFromState
} from "./providerSecrets.mjs";

test("stripProviderSecretsFromState removes API keys and extra headers from providers", () => {
  const state = {
    providers: [
      {
        id: "provider-deepseek",
        name: "DeepSeek",
        apiKey: "sk-deepseek",
        extraHeaders: [{ key: "x-org", value: "orbital" }]
      }
    ]
  };

  const sanitized = stripProviderSecretsFromState(state);
  assert.equal(sanitized.providers[0].apiKey, "");
  assert.deepEqual(sanitized.providers[0].extraHeaders, []);
});

test("applyProviderSecretsToState restores provider secrets from the secret map", () => {
  const state = {
    providers: [
      {
        id: "provider-openai",
        name: "OpenAI",
        apiKey: "",
        extraHeaders: []
      }
    ]
  };
  const secrets = new Map([
    [
      "provider-openai",
      {
        apiKey: "sk-openai",
        extraHeaders: [{ key: "x-openai-org", value: "orbital" }]
      }
    ]
  ]);

  const hydrated = applyProviderSecretsToState(state, secrets);
  assert.equal(hydrated.providers[0].apiKey, "sk-openai");
  assert.deepEqual(hydrated.providers[0].extraHeaders, [
    { key: "x-openai-org", value: "orbital" }
  ]);
});

test("extractProviderSecretPayload only reports actual secret material", () => {
  const secret = extractProviderSecretPayload({
    apiKey: "sk-test",
    extraHeaders: [{ key: "x-provider", value: "deepseek" }]
  });

  assert.equal(hasProviderSecretPayload(secret), true);
  assert.equal(
    hasProviderSecretPayload({
      apiKey: "",
      extraHeaders: []
    }),
    false
  );
});
