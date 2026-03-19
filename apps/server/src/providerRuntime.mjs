const trimSlash = (value) => value.replace(/\/$/, "");

const mergeHeaders = (provider, headers = {}) => {
  const merged = { ...headers };

  for (const header of provider.extraHeaders || []) {
    if (header?.key?.trim()) {
      merged[header.key.trim()] = header.value ?? "";
    }
  }

  return merged;
};

const normalizeContent = (content) => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          return String(part.text);
        }

        return JSON.stringify(part);
      })
      .join("\n");
  }

  return JSON.stringify(content);
};

const buildAuthHeaders = (provider) => {
  if (provider.kind === "anthropic") {
    return mergeHeaders(provider, {
      "x-api-key": provider.apiKey,
      "anthropic-version": provider.apiVersion || "2023-06-01",
      "Content-Type": "application/json"
    });
  }

  if (provider.kind === "gemini") {
    return mergeHeaders(provider, {
      "Content-Type": "application/json"
    });
  }

  return mergeHeaders(provider, {
    "Content-Type": "application/json",
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {})
  });
};

const ensureConfigured = (provider) => {
  if (!provider || !provider.enabled) {
    throw new Error("Provider is not enabled.");
  }

  if (!provider.baseUrl?.trim()) {
    throw new Error(`${provider.name} is missing a base URL.`);
  }

  if (provider.mode === "remote" && provider.kind !== "gemini" && !provider.apiKey?.trim()) {
    throw new Error(`${provider.name} is missing an API key.`);
  }

  if (provider.kind === "gemini" && !provider.apiKey?.trim()) {
    throw new Error(`${provider.name} is missing a Gemini API key.`);
  }

  if (!provider.model?.trim()) {
    throw new Error(`${provider.name} is missing a model name.`);
  }
};

const anthropicEndpoint = (provider) => {
  const root = trimSlash(provider.baseUrl);
  return root.includes("/v1") ? `${root}/messages` : `${root}/v1/messages`;
};

const openAiEndpoint = (provider, suffix) => {
  const root = trimSlash(provider.baseUrl);
  return root.endsWith(suffix) ? root : `${root}${suffix}`;
};

const geminiEndpoint = (provider, action) =>
  `${trimSlash(provider.baseUrl)}/models/${encodeURIComponent(provider.model)}:${action}?key=${encodeURIComponent(provider.apiKey)}`;

const extractAnthropicText = (payload) =>
  (payload.content || [])
    .map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean)
    .join("\n");

const extractGeminiText = (payload) =>
  (payload.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .filter(Boolean)
    .join("\n");

const openAiCompatibleContent = ({ systemPrompt, userPrompt, image }) => [
  ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
  {
    role: "user",
    content: image
      ? [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`
            }
          }
        ]
      : userPrompt
  }
];

export const generateText = async ({
  provider,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  image
}) => {
  ensureConfigured(provider);

  if (provider.kind === "anthropic") {
    const response = await fetch(anthropicEndpoint(provider), {
      method: "POST",
      headers: buildAuthHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 2048,
        temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [
          {
            role: "user",
            content: [
              ...(image
                ? [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: image.mimeType,
                        data: image.base64
                      }
                    }
                  ]
                : []),
              { type: "text", text: userPrompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    return extractAnthropicText(await response.json());
  }

  if (provider.kind === "gemini") {
    const response = await fetch(geminiEndpoint(provider, "generateContent"), {
      method: "POST",
      headers: buildAuthHeaders(provider),
      body: JSON.stringify({
        ...(systemPrompt
          ? {
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              }
            }
          : {}),
        generationConfig: { temperature },
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              ...(image
                ? [
                    {
                      inlineData: {
                        mimeType: image.mimeType,
                        data: image.base64
                      }
                    }
                  ]
                : [])
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    return extractGeminiText(await response.json());
  }

  if (provider.kind === "ollama") {
    const response = await fetch(openAiEndpoint(provider, "/api/chat"), {
      method: "POST",
      headers: buildAuthHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          {
            role: "user",
            content: userPrompt,
            ...(image ? { images: [image.base64] } : {})
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    return normalizeContent(payload.message?.content ?? "");
  }

  const response = await fetch(openAiEndpoint(provider, "/chat/completions"), {
    method: "POST",
    headers: buildAuthHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      temperature,
      messages: openAiCompatibleContent({ systemPrompt, userPrompt, image })
    })
  });

  if (!response.ok) {
    throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  return normalizeContent(payload.choices?.[0]?.message?.content ?? "");
};

export const transcribeAudio = async ({ provider, fileName, mimeType, buffer }) => {
  ensureConfigured(provider);

  if (
    provider.kind === "openai" ||
    provider.kind === "openai-compatible" ||
    provider.kind === "deepseek" ||
    provider.kind === "xai"
  ) {
    const body = new FormData();
    body.set("model", provider.model);
    body.set("file", new File([buffer], fileName, { type: mimeType }));

    const response = await fetch(openAiEndpoint(provider, "/audio/transcriptions"), {
      method: "POST",
      headers: mergeHeaders(provider, {
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {})
      }),
      body
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    return payload.text ?? "";
  }

  throw new Error(`${provider.name} does not currently expose transcription through Orbital.`);
};

export const embedText = async ({ provider, inputs }) => {
  ensureConfigured(provider);

  if (provider.kind === "gemini") {
    const embeddings = [];

    for (const input of inputs) {
      const response = await fetch(geminiEndpoint(provider, "embedContent"), {
        method: "POST",
        headers: buildAuthHeaders(provider),
        body: JSON.stringify({
          content: {
            parts: [{ text: input }]
          },
          taskType: "RETRIEVAL_DOCUMENT"
        })
      });

      if (!response.ok) {
        throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
      }

      const payload = await response.json();
      embeddings.push(payload.embedding?.values || []);
    }

    return embeddings;
  }

  if (provider.kind === "ollama") {
    const response = await fetch(openAiEndpoint(provider, "/api/embed"), {
      method: "POST",
      headers: buildAuthHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        input: inputs
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    return payload.embeddings || [];
  }

  const response = await fetch(openAiEndpoint(provider, "/embeddings"), {
    method: "POST",
    headers: buildAuthHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      input: inputs
    })
  });

  if (!response.ok) {
    throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  return (payload.data || []).map((item) => item.embedding || []);
};
