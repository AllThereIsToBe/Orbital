import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:http";

import { answerCourseQuestion, runWorkflow } from "./ai.mjs";
import { createAuthToken, passwordsMatch, readBearerToken, verifyAuthToken } from "./auth.mjs";
import { importIcsCalendar, listCalendarEvents } from "./calendar.mjs";
import { HOST, PORT } from "./config.mjs";
import {
  addMaterialRow,
  deleteProviderSecret,
  createFriendRequest,
  createUser,
  fromJson,
  getChatMessages,
  getChatThreads,
  getMaterialById,
  getProviderSecrets,
  getState,
  getStateWithProviderSecrets,
  getUserById,
  getUserByUsername,
  upsertProviderSecret,
  setState,
  replaceMaterialChunks,
  acceptFriendRequest,
  upsertSession
} from "./db.mjs";
import { buildChunks, extractMaterialText, persistUpload } from "./ingestion.mjs";
import {
  badRequest,
  created,
  notFound,
  ok,
  readJsonBody,
  sendFile,
  sendJson,
  unauthorized,
  withCors
} from "./http.mjs";
import {
  extractProviderSecretPayload,
  sanitizeProvider,
  stripProviderSecretsFromState
} from "./providerSecrets.mjs";
import { buildLeaderboard, getFriendData } from "./social.mjs";
import { broadcast, attachStream } from "./sse.mjs";

const safeState = (state) => ({
  ...state,
  sessions: [...state.sessions].sort(
    (left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime()
  )
});

const getAuthedUser = (request) => {
  const token = readBearerToken(request);
  const payload = verifyAuthToken(token);

  if (!payload) {
    return null;
  }

  return getUserById.get(payload.sub) || null;
};

const getUserFromQueryToken = (queryToken) => {
  const payload = verifyAuthToken(queryToken);
  return payload ? getUserById.get(payload.sub) || null : null;
};

const getSnapshot = (userId) => {
  const rawState = getState(userId);

  if (!rawState) {
    throw new Error("State not found.");
  }

  const state = safeState(stripProviderSecretsFromState(rawState));
  return {
    appState: state,
    calendarEvents: listCalendarEvents(userId),
    friendships: getFriendData(userId),
    leaderboard: buildLeaderboard(userId, "week"),
    user: (() => {
      const user = getUserById.get(userId);
      return user ? { id: user.id, username: user.username, createdAt: user.created_at } : null;
    })()
  };
};

const selectCourse = (state, courseId) => state.courses.find((course) => course.id === courseId);

const ensureChatThreadCourse = (state, courseId) => {
  const course = selectCourse(state, courseId);
  if (!course) {
    throw new Error("Course not found.");
  }
  return course;
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  if (request.method === "OPTIONS") {
    withCors(response);
    return;
  }

  try {
    if (pathname === "/api/health" && request.method === "GET") {
      ok(response, {
        ok: true,
        service: "orbital-server",
        port: PORT
      });
      return;
    }

    if (pathname === "/api/auth/register" && request.method === "POST") {
      const body = await readJsonBody(request);

      if (!body.username || !body.password || body.password.length < 6) {
        badRequest(response, "Provide a username and a password of at least 6 characters.");
        return;
      }

      if (getUserByUsername.get(body.username)) {
        badRequest(response, "Username is already taken.");
        return;
      }

      const user = createUser(body.username, body.password);
      created(response, {
        token: createAuthToken({ id: user.id, username: user.username }),
        snapshot: getSnapshot(user.id)
      });
      return;
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readJsonBody(request);
      const user = getUserByUsername.get(body.username || "");

      if (!user || !passwordsMatch(body.password || "", user.password_salt, user.password_hash)) {
        unauthorized(response);
        return;
      }

      ok(response, {
        token: createAuthToken({ id: user.id, username: user.username }),
        snapshot: getSnapshot(user.id)
      });
      return;
    }

    if (pathname === "/api/events/stream" && request.method === "GET") {
      const streamUser = getUserFromQueryToken(query.token);

      if (!streamUser) {
        unauthorized(response);
        return;
      }

      attachStream(request, response);
      return;
    }

    const user = getAuthedUser(request);

    if (!user) {
      unauthorized(response);
      return;
    }

    if (pathname === "/api/auth/me" && request.method === "GET") {
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/snapshot" && request.method === "GET") {
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/snapshot/import" && request.method === "POST") {
      const body = await readJsonBody(request);

      if (!body.appState || typeof body.appState !== "object") {
        badRequest(response, "appState is required.");
        return;
      }

      const importedState = structuredClone(body.appState);
      const nextProviderIds = new Set((importedState.providers || []).map((provider) => provider.id));

      for (const [providerId] of getProviderSecrets(user.id)) {
        if (!nextProviderIds.has(providerId)) {
          deleteProviderSecret(user.id, providerId);
        }
      }

      for (const provider of importedState.providers || []) {
        const secret = extractProviderSecretPayload(provider);
        const hasSecretPayload = Boolean(
          secret.apiKey || (secret.extraHeaders && secret.extraHeaders.length > 0)
        );

        if (hasSecretPayload) {
          upsertProviderSecret(user.id, provider.id, secret);
          continue;
        }

        deleteProviderSecret(user.id, provider.id);
      }

      setState(user.id, stripProviderSecretsFromState(importedState));
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/log-session" && request.method === "POST") {
      const { session } = await readJsonBody(request);
      const state = getState(user.id);
      state.sessions = [session, ...state.sessions.filter((item) => item.id !== session.id)];
      state.tasks = state.tasks.map((task) =>
        task.id === session.taskId
          ? {
              ...task,
              status: task.status === "todo" ? "in_progress" : task.status,
              focusMinutesLogged: task.focusMinutesLogged + session.durationMin
            }
          : task
      );
      setState(user.id, state);
      upsertSession(user.id, session);
      broadcast("leaderboard", { userId: user.id });
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/set-task-status" && request.method === "POST") {
      const { taskId, status } = await readJsonBody(request);
      const state = getState(user.id);
      state.tasks = state.tasks.map((task) =>
        task.id === taskId ? { ...task, status } : task
      );
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/add-task" && request.method === "POST") {
      const { task } = await readJsonBody(request);
      const state = getState(user.id);
      state.tasks = [task, ...state.tasks];
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/add-note" && request.method === "POST") {
      const { note } = await readJsonBody(request);
      const state = getState(user.id);
      state.courses = state.courses.map((course) =>
        course.id === note.courseId ? { ...course, notes: [note, ...course.notes] } : course
      );
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/add-flashcard" && request.method === "POST") {
      const { card } = await readJsonBody(request);
      const state = getState(user.id);
      state.flashcards = [card, ...state.flashcards.filter((item) => item.id !== card.id)];
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/review-flashcard" && request.method === "POST") {
      const { card } = await readJsonBody(request);
      const state = getState(user.id);
      state.flashcards = state.flashcards.map((item) => (item.id === card.id ? card : item));
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/delete-flashcard" && request.method === "POST") {
      const { cardId } = await readJsonBody(request);
      const state = getState(user.id);
      state.flashcards = state.flashcards.filter((item) => item.id !== cardId);
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/add-provider" && request.method === "POST") {
      const { provider } = await readJsonBody(request);
      const state = getState(user.id);
      upsertProviderSecret(user.id, provider.id, extractProviderSecretPayload(provider));
      state.providers = [
        sanitizeProvider(provider),
        ...state.providers.filter((item) => item.id !== provider.id)
      ];
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/remove-provider" && request.method === "POST") {
      const { providerId } = await readJsonBody(request);
      const state = getState(user.id);
      deleteProviderSecret(user.id, providerId);
      state.providers = state.providers.filter((provider) => provider.id !== providerId);
      state.workflows = state.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.map((step) =>
          step.providerId === providerId
            ? {
                ...step,
                providerId: state.providers.find((provider) => provider.id !== providerId)?.id || step.providerId
              }
            : step
        )
      }));
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/update-provider" && request.method === "POST") {
      const { providerId, patch } = await readJsonBody(request);
      const state = getState(user.id);
      const runtimeState = getStateWithProviderSecrets(user.id) || state;
      const currentRuntimeProvider = runtimeState.providers.find((provider) => provider.id === providerId);
      const { apiKey: _nextApiKey, extraHeaders: _nextExtraHeaders, ...metadataPatch } = patch || {};
      const nextRuntimeProvider = currentRuntimeProvider
        ? {
            ...currentRuntimeProvider,
            ...patch,
            capabilities: { ...currentRuntimeProvider.capabilities, ...(patch.capabilities || {}) }
          }
        : null;

      if (nextRuntimeProvider) {
        upsertProviderSecret(
          user.id,
          providerId,
          extractProviderSecretPayload(nextRuntimeProvider)
        );
      }

      state.providers = state.providers.map((provider) =>
        provider.id === providerId
          ? sanitizeProvider({
              ...provider,
              ...metadataPatch,
              capabilities: { ...provider.capabilities, ...(patch.capabilities || {}) }
            })
          : provider
      );
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/upsert-workflow" && request.method === "POST") {
      const { workflow } = await readJsonBody(request);
      const state = getState(user.id);
      state.workflows = state.workflows.some((item) => item.id === workflow.id)
        ? state.workflows.map((item) => (item.id === workflow.id ? workflow : item))
        : [workflow, ...state.workflows];
      setState(user.id, state);
      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname === "/api/actions/add-material" && request.method === "POST") {
      const body = await readJsonBody(request);
      const state = getState(user.id);
      const runtimeState = getStateWithProviderSecrets(user.id) || state;
      const providers = runtimeState.providers || [];
      const buffer = Buffer.from(body.fileBase64, "base64");
      const path = await persistUpload({
        materialId: body.material.id,
        fileName: body.fileName,
        buffer
      });
      const extraction = await extractMaterialText({
        mimeType: body.mimeType || "application/octet-stream",
        fileName: body.fileName,
        buffer,
        providers
      });
      const material = {
        ...body.material,
        extractedText: extraction.extractedText,
        sizeBytes: buffer.byteLength
      };

      state.courses = state.courses.map((course) => {
        if (course.id !== material.courseId) {
          return course;
        }

        return {
          ...course,
          materials: [material, ...course.materials],
          lessons: course.lessons.map((lesson) =>
            material.lessonIds.includes(lesson.id)
              ? {
                  ...lesson,
                  linkedMaterialIds: [...lesson.linkedMaterialIds, material.id]
                }
              : lesson
          )
        };
      });
      setState(user.id, state);

      addMaterialRow({
        id: material.id,
        userId: user.id,
        courseId: material.courseId,
        lessonIds: material.lessonIds,
        name: material.name,
        kind: material.kind,
        mime: body.mimeType || "application/octet-stream",
        path,
        sizeBytes: material.sizeBytes,
        createdAt: material.createdAt,
        tags: material.tags,
        extractedText: extraction.extractedText,
        processingStatus: extraction.processingStatus
      });

      replaceMaterialChunks(
        material.id,
        user.id,
        material.courseId,
        buildChunks(extraction.extractedText)
      );

      ok(response, getSnapshot(user.id));
      return;
    }

    if (pathname?.startsWith("/api/materials/") && pathname.endsWith("/file") && request.method === "GET") {
      const materialId = pathname.split("/")[3];
      const row = getMaterialById.get(materialId, user.id);

      if (!row || !existsSync(row.path)) {
        notFound(response, "Material file not found.");
        return;
      }

      await sendFile(response, 200, row.path, row.mime);
      return;
    }

    if (pathname === "/api/calendar/import-ics" && request.method === "POST") {
      const body = await readJsonBody(request);

      if (!body.name || !body.icsText) {
        badRequest(response, "Calendar name and ICS text are required.");
        return;
      }

      const events = importIcsCalendar(user.id, body.name, body.icsText);
      ok(response, { events, snapshot: getSnapshot(user.id) });
      return;
    }

    if (pathname === "/api/calendar/events" && request.method === "GET") {
      ok(response, { events: listCalendarEvents(user.id) });
      return;
    }

    if (pathname === "/api/social/friends/request" && request.method === "POST") {
      const body = await readJsonBody(request);
      const target = getUserByUsername.get(body.username || "");

      if (!target || target.id === user.id) {
        badRequest(response, "Friend target not found.");
        return;
      }

      createFriendRequest(user.id, target.id);
      broadcast("friendship", { userId: user.id, targetId: target.id });
      ok(response, { friendships: getFriendData(user.id) });
      return;
    }

    if (pathname === "/api/social/friends/accept" && request.method === "POST") {
      const body = await readJsonBody(request);
      acceptFriendRequest.run(new Date().toISOString(), body.friendshipId);
      broadcast("friendship", { userId: user.id });
      ok(response, { friendships: getFriendData(user.id) });
      return;
    }

    if (pathname === "/api/social/leaderboard" && request.method === "GET") {
      ok(response, {
        rows: buildLeaderboard(user.id, query.window || "week", query.tagId || "")
      });
      return;
    }

    if (pathname === "/api/chat/threads" && request.method === "GET") {
      if (!query.courseId) {
        badRequest(response, "courseId is required.");
        return;
      }

      ensureChatThreadCourse(getState(user.id), query.courseId);
      ok(response, { threads: getChatThreads.all(user.id, query.courseId) });
      return;
    }

    if (pathname === "/api/chat/messages" && request.method === "GET") {
      if (!query.courseId || !query.threadId) {
        badRequest(response, "courseId and threadId are required.");
        return;
      }

      ok(response, {
        messages: getChatMessages.all(user.id, query.courseId, query.threadId).map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          citations: fromJson(row.citations_json, []),
          createdAt: row.created_at
        }))
      });
      return;
    }

    if (pathname === "/api/chat/ask" && request.method === "POST") {
      const body = await readJsonBody(request);
      const state = getStateWithProviderSecrets(user.id) || getState(user.id);
      const result = await answerCourseQuestion({
        user,
        state,
        courseId: body.courseId,
        threadId: body.threadId,
        threadTitle: body.threadTitle,
        question: body.question,
        providerId: body.providerId,
        dbBroadcast: broadcast
      });
      ok(response, result);
      return;
    }

    if (pathname === "/api/ai/workflows/run" && request.method === "POST") {
      const body = await readJsonBody(request);
      const state = getStateWithProviderSecrets(user.id) || getState(user.id);
      ok(
        response,
        await runWorkflow({
          state,
          workflowId: body.workflowId,
          userBrief: body.userBrief || "",
          courseId: body.courseId
        })
      );
      return;
    }

    notFound(response);
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 400;
    sendJson(response, statusCode, {
      error: error instanceof Error ? error.message : "Request failed."
    });
  }
}).listen(PORT, HOST, () => {
  console.log(`Orbital server running on http://${HOST}:${PORT}`);
});
