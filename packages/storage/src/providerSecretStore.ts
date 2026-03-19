import type { AIProvider, AppState } from "@orbital/domain";

const PROVIDER_SECRETS_KEY = "orbital-provider-secrets-v1";

type ProviderSecretRecord = Record<
  string,
  {
    apiKey: string;
    extraHeaders: AIProvider["extraHeaders"];
  }
>;

const cloneExtraHeaders = (headers: AIProvider["extraHeaders"] = []) =>
  headers.map((header) => ({
    key: header.key,
    value: header.value
  }));

const getStorage = () => (typeof window === "undefined" ? null : window.localStorage);

const normalizeSecrets = (value: unknown): ProviderSecretRecord => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([providerId, secret]) => {
      const candidate = secret && typeof secret === "object" ? secret : {};
      const extraHeaders = Array.isArray((candidate as { extraHeaders?: unknown }).extraHeaders)
        ? cloneExtraHeaders(
            ((candidate as { extraHeaders?: Array<{ key?: string; value?: string }> }).extraHeaders || []).map(
              (header) => ({
                key: header?.key ?? "",
                value: header?.value ?? ""
              })
            )
          )
        : [];

      return [
        providerId,
        {
          apiKey:
            typeof (candidate as { apiKey?: unknown }).apiKey === "string"
              ? (candidate as { apiKey: string }).apiKey
              : "",
          extraHeaders
        }
      ];
    })
  );
};

export const loadProviderSecrets = (): ProviderSecretRecord => {
  const storage = getStorage();

  if (!storage) {
    return {};
  }

  const raw = storage.getItem(PROVIDER_SECRETS_KEY);

  if (!raw) {
    return {};
  }

  try {
    return normalizeSecrets(JSON.parse(raw));
  } catch {
    return {};
  }
};

export const persistProviderSecrets = (providers: AIProvider[]) => {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const nextSecrets = Object.fromEntries(
    providers.flatMap((provider) => {
      const apiKey = provider.apiKey || "";
      const extraHeaders = cloneExtraHeaders(provider.extraHeaders);

      if (!apiKey.trim() && extraHeaders.length === 0) {
        return [];
      }

      return [[provider.id, { apiKey, extraHeaders }]];
    })
  );

  storage.setItem(PROVIDER_SECRETS_KEY, JSON.stringify(nextSecrets));
};

export const stripProviderSecrets = (providers: AIProvider[]): AIProvider[] =>
  providers.map((provider) => ({
    ...provider,
    apiKey: "",
    extraHeaders: []
  }));

export const applyStoredProviderSecrets = (providers: AIProvider[]): AIProvider[] => {
  const secrets = loadProviderSecrets();

  return providers.map((provider) => {
    const secret = secrets[provider.id];

    if (!secret) {
      return {
        ...provider,
        extraHeaders: cloneExtraHeaders(provider.extraHeaders)
      };
    }

    return {
      ...provider,
      apiKey: secret.apiKey,
      extraHeaders: cloneExtraHeaders(secret.extraHeaders)
    };
  });
};

export const stripProviderSecretsFromState = (state: AppState): AppState => ({
  ...state,
  providers: stripProviderSecrets(state.providers)
});

export const applyStoredProviderSecretsToState = (state: AppState): AppState => ({
  ...state,
  providers: applyStoredProviderSecrets(state.providers)
});
