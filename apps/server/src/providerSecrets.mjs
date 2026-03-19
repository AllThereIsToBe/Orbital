const cloneExtraHeaders = (headers = []) =>
  (Array.isArray(headers) ? headers : []).map((header) => ({
    key: header?.key ?? "",
    value: header?.value ?? ""
  }));

export const sanitizeProvider = (provider) => ({
  ...provider,
  apiKey: "",
  extraHeaders: []
});

export const stripProviderSecretsFromState = (state) => ({
  ...state,
  providers: (state.providers || []).map(sanitizeProvider)
});

export const extractProviderSecretPayload = (provider) => ({
  apiKey: provider?.apiKey ?? "",
  extraHeaders: cloneExtraHeaders(provider?.extraHeaders)
});

export const hasProviderSecretPayload = (secret) =>
  Boolean(secret.apiKey?.trim() || (secret.extraHeaders || []).length > 0);

export const applyProviderSecretsToState = (state, secrets = new Map()) => ({
  ...state,
  providers: (state.providers || []).map((provider) => {
    const secret = secrets.get(provider.id);

    if (!secret) {
      return {
        ...provider,
        extraHeaders: cloneExtraHeaders(provider.extraHeaders)
      };
    }

    return {
      ...provider,
      apiKey: secret.apiKey ?? "",
      extraHeaders: cloneExtraHeaders(secret.extraHeaders)
    };
  })
});
