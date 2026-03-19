import type { AIProvider, AppState } from "./models.ts";
import { createSeedState } from "./seed.ts";

const inferProviderKind = (provider: Partial<AIProvider>): AIProvider["kind"] => {
  const lower = `${provider.name || ""} ${provider.baseUrl || ""}`.toLowerCase();

  if (lower.includes("anthropic") || lower.includes("claude")) {
    return "anthropic";
  }

  if (lower.includes("deepseek")) {
    return "deepseek";
  }

  if (lower.includes("x.ai") || lower.includes("grok")) {
    return "xai";
  }

  if (lower.includes("gemini") || lower.includes("googleapis")) {
    return "gemini";
  }

  if (lower.includes("ollama")) {
    return "ollama";
  }

  if (lower.includes("openai")) {
    return "openai";
  }

  return "openai-compatible";
};

const migrateBuiltInWorkflow = (workflow: AppState["workflows"][number]) => {
  if (
    workflow.id !== "workflow-lecture-brief" &&
    workflow.id !== "workflow-exam-prep"
  ) {
    return workflow;
  }

  return {
    ...workflow,
    steps: workflow.steps.map((step) =>
      step.providerId === "provider-ollama" ? { ...step, providerId: "provider-openai-compatible" } : step
    )
  };
};

export const normalizeAppState = (state: AppState): AppState => {
  const fallback = createSeedState();
  const defaultCapabilities = fallback.providers[0].capabilities;
  const providerMap = new Map(fallback.providers.map((provider) => [provider.id, provider]));
  const workflowMap = new Map(fallback.workflows.map((workflow) => [workflow.id, workflow]));
  const normalizedFlashcards = (state.flashcards || []).map((card) => {
    const createdAt = card.createdAt || new Date().toISOString();
    const updatedAt = card.updatedAt || card.createdAt || createdAt;
    const dueAt = card.dueAt || card.createdAt || createdAt;
    return Object.assign(
      {
        tagIds: [],
        prompt: "",
        answer: "",
        createdAt,
        updatedAt,
        dueAt,
        state: "new" as const,
        intervalMinutes: 0,
        ease: 2.3,
        reviewCount: 0,
        lapseCount: 0
      },
      card,
      {
        createdAt,
        updatedAt,
        dueAt
      }
    );
  });

  return {
    ...fallback,
    ...state,
    flashcards: normalizedFlashcards.length > 0 ? normalizedFlashcards : fallback.flashcards,
    providers: [
      ...(state.providers || []).map((provider) => {
        const baseline = providerMap.get(provider.id) || fallback.providers[0];
        return {
          ...baseline,
          ...provider,
          kind: provider.kind || inferProviderKind(provider),
          apiVersion: provider.apiVersion || baseline.apiVersion,
          extraHeaders: Array.isArray(provider.extraHeaders) ? provider.extraHeaders : baseline.extraHeaders || [],
          capabilities: {
            ...defaultCapabilities,
            ...baseline.capabilities,
            ...(provider.capabilities || {})
          }
        };
      }),
      ...fallback.providers.filter(
        (provider) => !(state.providers || []).some((existing) => existing.id === provider.id)
      )
    ],
    workflows: [
      ...(state.workflows || []).map((workflow) =>
        migrateBuiltInWorkflow({
          ...(workflowMap.get(workflow.id) || workflow),
          ...workflow,
          steps: workflow.steps || workflowMap.get(workflow.id)?.steps || []
        })
      ),
      ...fallback.workflows.filter(
        (workflow) => !(state.workflows || []).some((existing) => existing.id === workflow.id)
      )
    ]
  };
};
