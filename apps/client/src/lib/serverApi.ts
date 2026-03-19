import type {
  AppState,
  CourseChatMessage,
  Friendship,
  LeaderboardEntry,
  PlatformSnapshot,
  WorkflowRunResult
} from "@orbital/domain";

import type { AppAction } from "./usePersistentAppState";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8787";
const TOKEN_KEY = "orbital-auth-token";
const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  });

const request = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      throw new Error(
        payload?.error || payload?.message || `Request failed with ${response.status}.`
      );
    }

    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
};

export const getStoredToken = () => window.localStorage.getItem(TOKEN_KEY);
export const storeToken = (token: string) => window.localStorage.setItem(TOKEN_KEY, token);
export const clearStoredToken = () => window.localStorage.removeItem(TOKEN_KEY);

export const pingServer = async () =>
  request<{ ok: boolean }>("/api/health", { method: "GET" });

export const register = async (username: string, password: string) =>
  request<{ token: string; snapshot: PlatformSnapshot }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

export const login = async (username: string, password: string) =>
  request<{ token: string; snapshot: PlatformSnapshot }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

export const getSnapshot = async (token: string) =>
  request<PlatformSnapshot>("/api/snapshot", { method: "GET" }, token);

export const importSnapshot = async (appState: AppState, token: string) =>
  request<PlatformSnapshot>(
    "/api/snapshot/import",
    {
      method: "POST",
      body: JSON.stringify({ appState })
    },
    token
  );

const actionPath = (action: AppAction) => {
  switch (action.type) {
    case "logSession":
      return { path: "/api/actions/log-session", body: { session: action.session } };
    case "setTaskStatus":
      return { path: "/api/actions/set-task-status", body: { taskId: action.taskId, status: action.status } };
    case "addTask":
      return { path: "/api/actions/add-task", body: { task: action.task } };
    case "addNote":
      return { path: "/api/actions/add-note", body: { note: action.note } };
    case "addFlashcard":
      return { path: "/api/actions/add-flashcard", body: { card: action.card } };
    case "reviewFlashcard":
      return { path: "/api/actions/review-flashcard", body: { card: action.card } };
    case "deleteFlashcard":
      return { path: "/api/actions/delete-flashcard", body: { cardId: action.cardId } };
    case "addProvider":
      return { path: "/api/actions/add-provider", body: { provider: action.provider } };
    case "removeProvider":
      return { path: "/api/actions/remove-provider", body: { providerId: action.providerId } };
    case "updateProvider":
      return { path: "/api/actions/update-provider", body: { providerId: action.providerId, patch: action.patch } };
    case "upsertWorkflow":
      return { path: "/api/actions/upsert-workflow", body: { workflow: action.workflow } };
    default:
      return null;
  }
};

export const syncAction = async (action: AppAction, token: string) => {
  const mapping = actionPath(action);

  if (!mapping) {
    return null;
  }

  return request<PlatformSnapshot>(
    mapping.path,
    { method: "POST", body: JSON.stringify(mapping.body) },
    token
  );
};

export const uploadMaterial = async (
  args: {
    material: AppState["courses"][number]["materials"][number];
    file: File;
  },
  token: string
) => {
  if (args.file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error("Files larger than 20 MB are not supported by the current upload path.");
  }

  const fileBase64 = await readFileAsBase64(args.file);

  return request<PlatformSnapshot>(
    "/api/actions/add-material",
    {
      method: "POST",
      body: JSON.stringify({
        material: args.material,
        fileName: args.file.name,
        mimeType: args.file.type || "application/octet-stream",
        fileBase64
      })
    },
    token
  );
};

export const importCalendar = async (name: string, icsText: string, token: string) =>
  request<{ snapshot: PlatformSnapshot }>("/api/calendar/import-ics", {
    method: "POST",
    body: JSON.stringify({ name, icsText })
  }, token);

export const sendFriendRequest = async (username: string, token: string) =>
  request<{ friendships: Friendship[] }>("/api/social/friends/request", {
    method: "POST",
    body: JSON.stringify({ username })
  }, token);

export const acceptFriendship = async (friendshipId: string, token: string) =>
  request<{ friendships: Friendship[] }>("/api/social/friends/accept", {
    method: "POST",
    body: JSON.stringify({ friendshipId })
  }, token);

export const fetchLeaderboard = async (windowName: string, tagId: string, token: string) =>
  request<{ rows: LeaderboardEntry[] }>(
    `/api/social/leaderboard?window=${encodeURIComponent(windowName)}&tagId=${encodeURIComponent(tagId)}`,
    { method: "GET" },
    token
  );

export const askCourse = async (
  payload: {
    courseId: string;
    question: string;
    threadId?: string;
    threadTitle?: string;
    providerId?: string;
  },
  token: string
) =>
  request<{
    threadId: string;
    answer: string;
    citations: CourseChatMessage["citations"];
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      citations_json?: string;
      citations?: CourseChatMessage["citations"];
      created_at?: string;
      createdAt?: string;
    }>;
  }>("/api/chat/ask", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);

export const getChatMessages = async (courseId: string, threadId: string, token: string) =>
  request<{ messages: CourseChatMessage[] }>(
    `/api/chat/messages?courseId=${encodeURIComponent(courseId)}&threadId=${encodeURIComponent(threadId)}`,
    { method: "GET" },
    token
  );

export const openMaterialBlob = async (materialId: string, token: string) => {
  const response = await fetch(`${API_BASE}/api/materials/${materialId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Unable to open raw material.");
  }

  return response.blob();
};

export const runServerWorkflow = async (
  workflowId: string,
  courseId: string | undefined,
  userBrief: string,
  token: string
) =>
  request<WorkflowRunResult>("/api/ai/workflows/run", {
    method: "POST",
    body: JSON.stringify({ workflowId, courseId, userBrief })
  }, token);

export const createEventSource = (token: string) => {
  const url = new URL(`${API_BASE}/api/events/stream`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return new EventSource(url, { withCredentials: false });
};
