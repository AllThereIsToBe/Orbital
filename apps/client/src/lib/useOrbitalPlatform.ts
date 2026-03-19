import type {
  CalendarEvent,
  CourseChatMessage,
  Friendship,
  LeaderboardEntry,
  PlatformSnapshot,
  UserSummary,
  WorkflowRunResult
} from "@orbital/domain";
import { applyStoredProviderSecretsToState } from "@orbital/storage";
import { useEffect, useMemo, useState } from "react";

import {
  acceptFriendship,
  askCourse,
  clearStoredToken,
  createEventSource,
  fetchLeaderboard,
  getChatMessages,
  getSnapshot,
  importSnapshot,
  getStoredToken,
  importCalendar,
  login,
  openMaterialBlob,
  pingServer,
  register,
  runServerWorkflow,
  sendFriendRequest,
  storeToken,
  syncAction,
  uploadMaterial
} from "./serverApi";
import { usePersistentAppState, type AppAction } from "./usePersistentAppState";

export const useOrbitalPlatform = () => {
  const local = usePersistentAppState();
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [error, setError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [user, setUser] = useState<UserSummary | null>(null);

  const hydrateSnapshot = (next: PlatformSnapshot): PlatformSnapshot => ({
    ...next,
    appState: applyStoredProviderSecretsToState(next.appState)
  });

  const applySnapshot = (next: PlatformSnapshot) => {
    setSnapshot(next);
    setCalendarEvents(next.calendarEvents);
    setFriendships(next.friendships);
    setLeaderboard(next.leaderboard);
    setUser(next.user);
    setConnection("online");
  };

  const replaceLocalState = (nextState: PlatformSnapshot["appState"]) => {
    local.dispatch({
      type: "replaceState",
      state: nextState
    });
  };

  const refreshSnapshot = async (authToken = token) => {
    if (!authToken) {
      setSnapshot(null);
      return null;
    }

    try {
      const next = hydrateSnapshot(await getSnapshot(authToken));
      applySnapshot(next);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load server snapshot.");
      return null;
    }
  };

  useEffect(() => {
    pingServer()
      .then(() => setConnection("online"))
      .catch(() => setConnection("offline"));
  }, []);

  useEffect(() => {
    if (connection !== "online" || !token) {
      return;
    }

    void refreshSnapshot(token);
  }, [connection, token]);

  useEffect(() => {
    if (connection !== "online") {
      return;
    }

    const source = createEventSource(token || "");
    source.addEventListener("leaderboard", () => void refreshSnapshot(token));
    source.addEventListener("friendship", () => void refreshSnapshot(token));
    source.addEventListener("chat", () => void refreshSnapshot(token));
    source.onerror = () => source.close();

    return () => source.close();
  }, [connection, token]);

  const dispatch = (action: AppAction) => {
    local.dispatch(action);

    if (connection !== "online" || !token) {
      return;
    }

    void syncAction(action, token)
      .then((next) => {
        if (next) {
          const snapshot = hydrateSnapshot(next);
          setSnapshot(snapshot);
          setCalendarEvents(snapshot.calendarEvents);
          setFriendships(snapshot.friendships);
          setLeaderboard(snapshot.leaderboard);
          setUser(snapshot.user);
        }
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to sync action.");
      });
  };

  const auth = {
    user,
    token,
    async login(username: string, password: string) {
      const result = await login(username, password);
      const snapshot = hydrateSnapshot(result.snapshot);
      storeToken(result.token);
      setToken(result.token);
      applySnapshot(snapshot);
      replaceLocalState(snapshot.appState);
    },
    async register(username: string, password: string) {
      const result = await register(username, password);
      const snapshot = hydrateSnapshot(result.snapshot);
      storeToken(result.token);
      setToken(result.token);
      applySnapshot(snapshot);
      replaceLocalState(snapshot.appState);
    },
    logout() {
      clearStoredToken();
      setToken(null);
      setSnapshot(null);
      setCalendarEvents([]);
      setFriendships([]);
      setLeaderboard([]);
      setUser(null);
    }
  };

  const server = useMemo(
    () => ({
      enabled: connection === "online" && Boolean(token && user),
      connection,
    async uploadMaterial(material: Parameters<typeof uploadMaterial>[0]["material"], file: File) {
      if (!token) {
        throw new Error("Sign in first.");
      }
      const snapshot = hydrateSnapshot(await uploadMaterial({ material, file }, token));
      applySnapshot(snapshot);
      replaceLocalState(snapshot.appState);
    },
    async importCalendar(name: string, icsText: string) {
      if (!token) {
        throw new Error("Sign in first.");
      }
      const snapshot = hydrateSnapshot((await importCalendar(name, icsText, token)).snapshot);
      applySnapshot(snapshot);
      replaceLocalState(snapshot.appState);
    },
      async requestFriend(username: string) {
        if (!token) {
          throw new Error("Sign in first.");
        }
        const result = await sendFriendRequest(username, token);
        setFriendships(result.friendships);
        await refreshSnapshot(token);
      },
      async acceptFriend(friendshipId: string) {
        if (!token) {
          throw new Error("Sign in first.");
        }
        const result = await acceptFriendship(friendshipId, token);
        setFriendships(result.friendships);
        await refreshSnapshot(token);
      },
      async refreshLeaderboard(windowName: string, tagId = "") {
        if (!token) {
          throw new Error("Sign in first.");
        }
        const result = await fetchLeaderboard(windowName, tagId, token);
        setLeaderboard(result.rows);
      },
      async askCourse(courseId: string, question: string, threadId?: string, providerId?: string) {
        if (!token) {
          throw new Error("Sign in first.");
        }
        const result = await askCourse(
          {
            courseId,
            question,
            threadId,
            threadTitle: question.slice(0, 48),
            providerId
          },
          token
        );
        await refreshSnapshot(token);
        return {
          threadId: result.threadId,
          answer: result.answer,
          citations: result.citations
        };
      },
      async getChatMessages(courseId: string, threadId: string) {
        if (!token) {
          return [] as CourseChatMessage[];
        }
        const result = await getChatMessages(courseId, threadId, token);
        return result.messages;
      },
      async openRawMaterial(materialId: string) {
        if (!token) {
          throw new Error("Sign in first.");
        }
        const blob = await openMaterialBlob(materialId, token);
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      },
      async runWorkflow(workflowId: string, courseId: string | undefined, userBrief: string) {
        if (!token) {
          throw new Error("Sign in first.");
        }
        return runServerWorkflow(workflowId, courseId, userBrief, token) as Promise<WorkflowRunResult>;
      }
    }),
    [connection, token, user]
  );

  return {
    state: snapshot?.appState ?? local.state,
    localState: local.state,
    dispatch,
    auth,
    server,
    cloudSync: {
      async pushLocalState() {
        if (!token) {
          throw new Error("Sign in first.");
        }

        const next = hydrateSnapshot(await importSnapshot(local.state, token));
        applySnapshot(next);
        replaceLocalState(next.appState);
      },
      async pullCloudState() {
        if (!token) {
          throw new Error("Sign in first.");
        }

        const next = hydrateSnapshot(await getSnapshot(token));
        applySnapshot(next);
        replaceLocalState(next.appState);
      }
    },
    error,
    calendarEvents,
    friendships,
    leaderboard,
    isCloudMode: server.enabled,
    connection
  };
};
