import type {
  AIProvider,
  AIProviderCapability,
  WorkflowDefinition,
  WorkflowRole,
  WorkflowRunResult,
  WorkflowRunStepResult
} from "@orbital/domain";

export interface ProviderChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: ProviderImageAttachment[];
}

export interface ProviderImageAttachment {
  name: string;
  mimeType: string;
  base64: string;
  dataUrl: string;
}

interface ChatWithProviderParams {
  provider: AIProvider;
  systemPrompt?: string;
  messages: ProviderChatMessage[];
  temperature?: number;
}

interface RunWorkflowParams {
  providers: AIProvider[];
  workflow: WorkflowDefinition;
  input: string;
}

const normalizeContent = (content: unknown) => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (entry && typeof entry === "object" && "text" in entry) {
          return String(entry.text);
        }

        return JSON.stringify(entry);
      })
      .join("\n");
  }

  return JSON.stringify(content);
};

class ProviderReachabilityError extends Error {
  providerId: string;

  constructor(providerId: string, message: string) {
    super(message);
    this.name = "ProviderReachabilityError";
    this.providerId = providerId;
  }
}

const capabilityHints: Record<WorkflowRole, AIProviderCapability[]> = {
  router: ["agentic", "reasoning", "chat"],
  retriever: ["embeddings", "reasoning", "chat"],
  vision: ["vision", "multimodal"],
  synthesizer: ["reasoning", "chat"],
  quizzer: ["reasoning", "chat"],
  tutor: ["reasoning", "chat"],
  planner: ["agentic", "reasoning", "chat"]
};

const trimSlash = (value: string) => value.replace(/\/$/, "");

const mergeHeaders = (provider: AIProvider, headers: Record<string, string>) => {
  const merged = { ...headers };

  for (const header of provider.extraHeaders || []) {
    if (header.key.trim()) {
      merged[header.key.trim()] = header.value;
    }
  }

  return merged;
};

const buildHeaders = (provider: AIProvider) => {
  if (provider.kind === "anthropic") {
    return mergeHeaders(provider, {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": provider.apiVersion || "2023-06-01"
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

const anthropicEndpoint = (provider: AIProvider) => {
  const root = trimSlash(provider.baseUrl);
  return root.includes("/v1") ? `${root}/messages` : `${root}/v1/messages`;
};

const geminiTextEndpoint = (provider: AIProvider) =>
  `${trimSlash(provider.baseUrl)}/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;

const openAiEndpoint = (provider: AIProvider, suffix: string) => {
  const root = trimSlash(provider.baseUrl);
  return root.endsWith(suffix) ? root : `${root}${suffix}`;
};

const toOpenAiCompatibleMessage = (message: ProviderChatMessage) => {
  if (!message.images?.length) {
    return {
      role: message.role,
      content: message.content
    };
  }

  return {
    role: message.role,
    content: [
      ...(message.content.trim() ? [{ type: "text", text: message.content }] : []),
      ...message.images.map((image) => ({
        type: "image_url",
        image_url: {
          url: image.dataUrl
        }
      }))
    ]
  };
};

const toAnthropicMessage = (message: ProviderChatMessage) => ({
  role: message.role,
  content: [
    ...(message.images || []).map((image) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mimeType,
        data: image.base64
      }
    })),
    ...(message.content.trim() ? [{ type: "text", text: message.content }] : [])
  ]
});

const toGeminiMessage = (message: ProviderChatMessage) => ({
  role: message.role === "assistant" ? "model" : "user",
  parts: [
    ...(message.content.trim() ? [{ text: message.content }] : []),
    ...(message.images || []).map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64
      }
    }))
  ]
});

const toOllamaMessage = (message: ProviderChatMessage) => ({
  role: message.role,
  content: message.content,
  ...(message.images?.length ? { images: message.images.map((image) => image.base64) } : {})
});

const fetchWithProviderError = async (
  provider: AIProvider,
  input: string,
  init: RequestInit
) => {
  try {
    return await fetch(input, init);
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Request failed before a response was returned.";

    if (provider.kind === "ollama" || provider.mode === "local") {
      throw new ProviderReachabilityError(
        provider.id,
        `Unable to reach ${provider.name} at ${provider.baseUrl}. If this is Ollama, make sure Ollama is running locally and exposing that endpoint. ${detail}`
      );
    }

    throw new ProviderReachabilityError(
      provider.id,
      `Unable to reach ${provider.name} from browser mode. This is often a CORS or network-policy issue for hosted APIs. Sign in and use the Orbital server path, or run a local endpoint such as Ollama. ${detail}`
    );
  }
};

const isCompatibleProvider = (provider: AIProvider, role: WorkflowRole) =>
  capabilityHints[role].some((capability) => provider.capabilities[capability]);

export const isRunnableProvider = (provider: AIProvider) => {
  if (!provider.enabled || !provider.baseUrl.trim() || !provider.model.trim()) {
    return false;
  }

  if (provider.kind === "gemini") {
    return Boolean(provider.apiKey.trim());
  }

  return provider.mode === "local" || Boolean(provider.apiKey.trim());
};

export const getChatCapableProviders = (providers: AIProvider[]) =>
  providers.filter(
    (provider) =>
      isRunnableProvider(provider) && (provider.capabilities.chat || provider.capabilities.reasoning)
  );

export const canAcceptImages = (provider: AIProvider) =>
  provider.capabilities.vision || provider.capabilities.multimodal;

const resolveProviderForStep = (
  providers: AIProvider[],
  step: WorkflowDefinition["steps"][number]
) => {
  const configured = providers.find((item) => item.id === step.providerId);

  if (configured?.enabled) {
    return configured;
  }

  const fallback = providers.find(
    (provider) => provider.enabled && isCompatibleProvider(provider, step.role)
  );

  if (fallback) {
    return fallback;
  }

  const enabledProviders = providers.filter((provider) => provider.enabled).map((provider) => provider.name);
  throw new Error(
    `Workflow step "${step.name}" is routed to ${configured?.name ?? step.providerId}, but that provider is disabled. Enabled providers: ${enabledProviders.join(", ") || "none"}.`
  );
};

const resolveAlternateProviderForStep = (
  providers: AIProvider[],
  step: WorkflowDefinition["steps"][number],
  excludedProviderId: string
) =>
  providers.find(
    (provider) =>
      provider.id !== excludedProviderId &&
      isCompatibleProvider(provider, step.role) &&
      isRunnableProvider(provider)
  );

export const chatWithProvider = async ({
  provider,
  systemPrompt,
  messages,
  temperature = 0.35
}: ChatWithProviderParams) => {
  if (messages.some((message) => (message.images?.length || 0) > 0) && !canAcceptImages(provider)) {
    throw new Error(`${provider.name} is not configured for image input. Enable a provider with vision or multimodal capability.`);
  }

  if (provider.kind === "anthropic") {
    const response = await fetchWithProviderError(provider, anthropicEndpoint(provider), {
      method: "POST",
      headers: buildHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 2048,
        temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages.map(toAnthropicMessage)
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    return payload.content?.map((part) => part.text || "").join("\n") || "";
  }

  if (provider.kind === "gemini") {
    const response = await fetchWithProviderError(provider, geminiTextEndpoint(provider), {
      method: "POST",
      headers: buildHeaders(provider),
      body: JSON.stringify({
        ...(systemPrompt
          ? {
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              }
            }
          : {}),
        contents: messages.map(toGeminiMessage),
        generationConfig: {
          temperature
        }
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  }

  if (provider.kind === "ollama") {
    const response = await fetchWithProviderError(provider, openAiEndpoint(provider, "/api/chat"), {
      method: "POST",
      headers: buildHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...messages.map(toOllamaMessage)
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`${provider.name} returned ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      message?: { content?: unknown };
    };
    return normalizeContent(payload.message?.content ?? "");
  }

  const response = await fetchWithProviderError(provider, openAiEndpoint(provider, "/chat/completions"), {
    method: "POST",
    headers: buildHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      temperature,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages.map(toOpenAiCompatibleMessage)
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${provider.name} returned ${response.status}: ${details}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return normalizeContent(payload.choices?.[0]?.message?.content ?? "");
};

const callProvider = (provider: AIProvider, systemPrompt: string, userPrompt: string) =>
  chatWithProvider({
    provider,
    systemPrompt,
    temperature: 0.2,
    messages: [{ role: "user", content: userPrompt }]
  });

export const runWorkflow = async ({
  providers,
  workflow,
  input
}: RunWorkflowParams): Promise<WorkflowRunResult> => {
  let transcript = input;
  const stepOutputs: WorkflowRunStepResult[] = [];

  for (const step of workflow.steps) {
    const provider = resolveProviderForStep(providers, step);

    if (!provider.baseUrl.trim()) {
      throw new Error(`Provider ${provider.name} is missing a base URL.`);
    }

    if (provider.mode === "remote" && provider.kind !== "gemini" && !provider.apiKey.trim()) {
      throw new Error(`Provider ${provider.name} is missing an API key.`);
    }

    if (provider.kind === "gemini" && !provider.apiKey.trim()) {
      throw new Error(`Provider ${provider.name} is missing an API key.`);
    }

    let output: string;
    let actualProvider = provider;

    try {
      output = await callProvider(provider, step.systemPrompt, transcript);
    } catch (reason) {
      const fallbackProvider =
        reason instanceof ProviderReachabilityError
          ? resolveAlternateProviderForStep(providers, step, provider.id)
          : undefined;

      if (!fallbackProvider) {
        throw reason;
      }

      output = await callProvider(fallbackProvider, step.systemPrompt, transcript);
      actualProvider = fallbackProvider;
    }

    stepOutputs.push({
      stepId: step.id,
      providerId: actualProvider.id,
      name: step.name,
      output
    });

    transcript = `Previous step: ${step.name}\n\n${output}`;
  }

  return {
    workflowId: workflow.id,
    input,
    finalOutput: stepOutputs.at(-1)?.output ?? "",
    steps: stepOutputs,
    completedAt: new Date().toISOString()
  };
};
