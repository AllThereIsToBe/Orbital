import { randomUUID } from "node:crypto";

import {
  getChatMessages,
  getChatThreads,
  getCourseChunks,
  insertChatMessage,
  setState
} from "./db.mjs";
import { generateText } from "./providerRuntime.mjs";
import { rankChunks } from "./retrieval.mjs";

const findProvider = (state, providerId) =>
  state.providers.find((provider) => provider.id === providerId) ||
  state.providers.find(
    (provider) => provider.enabled && (provider.capabilities?.reasoning || provider.capabilities?.chat)
  );

const canRunProvider = (provider) => {
  if (!provider?.enabled || !provider.baseUrl || !provider.model) {
    return false;
  }

  if (provider.kind === "gemini") {
    return Boolean(provider.apiKey);
  }

  return provider.mode === "local" || Boolean(provider.apiKey);
};

const compatibleForRole = {
  router: ["agentic", "reasoning", "chat"],
  retriever: ["embeddings", "reasoning", "chat"],
  vision: ["vision", "multimodal"],
  synthesizer: ["reasoning", "chat"],
  quizzer: ["reasoning", "chat"],
  tutor: ["reasoning", "chat"],
  planner: ["agentic", "reasoning", "chat"]
};

const resolveAlternateProvider = (state, step, excludedProviderId) =>
  state.providers.find(
    (provider) =>
      provider.id !== excludedProviderId &&
      canRunProvider(provider) &&
      compatibleForRole[step.role].some((capability) => provider.capabilities?.[capability])
  );

export const runWorkflow = async ({ state, workflowId, userBrief, courseId }) => {
  const workflow = state.workflows.find((item) => item.id === workflowId);

  if (!workflow) {
    throw new Error("Workflow not found.");
  }

  const course = state.courses.find((item) => item.id === courseId);
  const courseSnapshot = course
    ? [
        `${course.title} (${course.code})`,
        course.overview,
        ...course.lessons.map((lesson) => `${lesson.title}: ${lesson.objectives.join("; ")}`),
        ...course.materials.map((material) => `${material.kind} ${material.name}: ${(material.extractedText || "").slice(0, 200)}`)
      ].join("\n")
    : "";

  let transcript = workflow.inputMode === "manual-brief" ? userBrief.trim() : `${courseSnapshot}\n\n${userBrief.trim()}`.trim();
  const steps = [];

  for (const step of workflow.steps) {
    const provider = findProvider(state, step.providerId);

    if (!provider || !provider.enabled || !provider.baseUrl || !provider.model) {
      throw new Error(`Provider ${step.providerId} is not configured.`);
    }

    let output;
    let actualProvider = provider;

    try {
      output = await generateText({
        provider,
        systemPrompt: step.systemPrompt,
        userPrompt: transcript,
        temperature: 0.2
      });
    } catch (error) {
      const fallbackProvider =
        provider.mode === "local" || provider.kind === "ollama"
          ? resolveAlternateProvider(state, step, provider.id)
          : null;

      if (!fallbackProvider) {
        throw error;
      }

      output = await generateText({
        provider: fallbackProvider,
        systemPrompt: step.systemPrompt,
        userPrompt: transcript,
        temperature: 0.2
      });
      actualProvider = fallbackProvider;
    }

    steps.push({
      stepId: step.id,
      providerId: actualProvider.id,
      name: step.name,
      output
    });
    transcript = `Previous step: ${step.name}\n\n${output}`;
  }

  return {
    workflowId,
    input: userBrief,
    finalOutput: steps.at(-1)?.output ?? "",
    steps,
    completedAt: new Date().toISOString()
  };
};

const deterministicTutoring = ({ query, contextRows }) => {
  if (contextRows.length === 0) {
    return `I do not have indexed material for that question yet. Upload text, notes, or PDFs for this course first, then ask again.\n\nQuestion: ${query}`;
  }

  const bulletContext = contextRows
    .slice(0, 4)
    .map(
      (row, index) =>
        `${index + 1}. ${row.material_name} (${row.material_kind})\n${row.text.slice(0, 260)}`
    )
    .join("\n\n");

  return [
    `Question: ${query}`,
    "",
    "Best available course evidence:",
    bulletContext,
    "",
    "Suggested study move:",
    "Restate the concept in your own words, derive the governing relation from first principles, and then test yourself on one numerical or conceptual variation."
  ].join("\n");
};

export const answerCourseQuestion = async ({
  user,
  state,
  courseId,
  threadId,
  threadTitle,
  question,
  providerId,
  dbBroadcast
}) => {
  const chunks = getCourseChunks.all(user.id, courseId);
  const ranked = rankChunks(question, chunks);
  const course = state.courses.find((item) => item.id === courseId);

  if (!course) {
    throw new Error("Course not found.");
  }

  const context = [
    `Course: ${course.title}`,
    `Overview: ${course.overview ?? ""}`,
    ...course.lessons.map((lesson) => `${lesson.title}: ${lesson.objectives.join("; ")}`),
    ...ranked.map((row, index) => `Source ${index + 1} (${row.material_name}): ${row.text}`)
  ]
    .filter(Boolean)
    .join("\n\n");

  const chosenProvider = findProvider(state, providerId);
  let answer = deterministicTutoring({ query: question, contextRows: ranked });

  if (chosenProvider?.enabled && chosenProvider.baseUrl && chosenProvider.model) {
    try {
      answer = await generateText({
        provider: chosenProvider,
        systemPrompt:
          "You are a serious engineering tutor. Explain clearly, use the supplied course context, admit uncertainty, end with one active-recall question, and format all mathematics with markdown math delimiters: inline $...$ and display $$...$$.",
        userPrompt: `Context:\n${context}\n\nQuestion:\n${question}`,
        temperature: 0.2
      });
    } catch {
      answer = deterministicTutoring({ query: question, contextRows: ranked });
    }
  }

  const actualThreadId = threadId || `thread-${randomUUID()}`;
  const citations = ranked.map((row) => ({
    materialId: row.material_id,
    materialName: row.material_name,
    excerpt: row.text.slice(0, 220)
  }));

  insertChatMessage.run(
    randomUUID(),
    user.id,
    courseId,
    actualThreadId,
    "user",
    question,
    "[]",
    new Date().toISOString()
  );

  insertChatMessage.run(
    randomUUID(),
    user.id,
    courseId,
    actualThreadId,
    "assistant",
    answer,
    JSON.stringify(citations),
    new Date().toISOString()
  );

  const nextState = structuredClone(state);
  const courseIndex = nextState.courses.findIndex((item) => item.id === courseId);

  if (courseIndex >= 0) {
    const chats = nextState.courses[courseIndex].chats || [];
    const existing = chats.find((chat) => chat.id === actualThreadId);

    if (existing) {
      existing.lastActivityAt = new Date().toISOString();
    } else {
      chats.unshift({
        id: actualThreadId,
        title: threadTitle || question.slice(0, 48),
        purpose: "AI course chat",
        lastActivityAt: new Date().toISOString()
      });
    }

    nextState.courses[courseIndex].chats = chats;
    setState(user.id, nextState);
  }

  dbBroadcast("chat", { courseId, threadId: actualThreadId });

  return {
    threadId: actualThreadId,
    answer,
    citations,
    messages: getChatMessages.all(user.id, courseId, actualThreadId),
    threads: getChatThreads.all(user.id, courseId)
  };
};
