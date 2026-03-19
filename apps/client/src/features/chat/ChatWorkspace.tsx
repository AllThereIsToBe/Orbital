import type { AppState } from "@orbital/domain";
import { useEffect, useMemo, useState } from "react";

import { RichContent } from "../../components/RichContent";
import { SectionHeader } from "../../components/SectionHeader";
import { buildSelectedCoursesContext } from "../../lib/courseContext";
import { extractTextPreview } from "../../lib/indexedDbFileStore";
import {
  canAcceptImages,
  chatWithProvider,
  getChatCapableProviders,
  type ProviderChatMessage,
  type ProviderImageAttachment
} from "../../lib/openAiCompatible";
import { formatDateTime } from "../../lib/time";

type ChatMode = "general" | "study" | "problem" | "planner";
type AttachmentKind = "text" | "image";

interface ChatAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  addedAt: string;
  excerpt?: string;
  image?: ProviderImageAttachment;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  providerName?: string;
  attachments: ChatAttachment[];
}

interface ChatWorkspaceState {
  providerId: string;
  mode: ChatMode;
  selectedCourseIds: string[];
  messages: ChatMessage[];
}

interface StoredChatWorkspace {
  providerId: string;
  mode: ChatMode;
  selectedCourseIds: string[];
  messages: Array<Omit<ChatMessage, "attachments"> & { attachments?: Array<Pick<ChatAttachment, "id" | "kind" | "name" | "addedAt" | "excerpt">> }>;
}

interface ChatWorkspaceProps {
  state: AppState;
  embedded?: boolean;
  onOpenSettings?: () => void;
}

const STORAGE_KEY = "orbital-chat-workspace-v2";
const mathOutputInstruction =
  "When you write mathematics, always use markdown math delimiters: inline $...$ and display $$...$$. Never emit naked LaTeX commands or raw equations without delimiters.";

const chatModes: Array<{
  id: ChatMode;
  label: string;
  systemPrompt: string;
}> = [
  {
    id: "general",
    label: "General",
    systemPrompt:
      "You are Orbital, a serious but clear AI study and life assistant. Be concise when the user needs speed, detailed when the topic is technical, and keep the conversation organized."
  },
  {
    id: "study",
    label: "Study tutor",
    systemPrompt:
      "You are a rigorous tutor. Teach from first principles, surface misconceptions, and keep the user moving through the material instead of passively consuming text."
  },
  {
    id: "problem",
    label: "Problem coach",
    systemPrompt:
      "You are a demanding engineering problem-solving coach. Do not skip setup, assumptions, units, or why each step is justified."
  },
  {
    id: "planner",
    label: "Planner",
    systemPrompt:
      "You are an execution-focused academic planner. Turn vague goals into realistic next actions, time blocks, and fallback plans."
  }
];

const quickPrompts = [
  "Explain this topic from first principles.",
  "Turn this into a clean study plan for tonight.",
  "Quiz me and adapt to my mistakes.",
  "Help me solve the representative problem step by step."
];

const sanitizeAttachments = (attachments: ChatAttachment[]) =>
  attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    addedAt: attachment.addedAt,
    excerpt: attachment.kind === "image" ? attachment.excerpt || "Image attachment" : attachment.excerpt
  }));

const loadWorkspace = (): ChatWorkspaceState => {
  const fallback: ChatWorkspaceState = {
    providerId: "",
    mode: "general",
    selectedCourseIds: [],
    messages: []
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<StoredChatWorkspace>;
    return {
      ...fallback,
      ...parsed,
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map((message) => ({
            ...message,
            attachments: Array.isArray(message.attachments) ? message.attachments : []
          }))
        : []
    };
  } catch {
    return fallback;
  }
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });

export const ChatWorkspace = ({ state, embedded = false, onOpenSettings }: ChatWorkspaceProps) => {
  const availableProviders = useMemo(() => getChatCapableProviders(state.providers), [state.providers]);
  const [workspace, setWorkspace] = useState<ChatWorkspaceState>(loadWorkspace);
  const [draft, setDraft] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
  const [contextQuery, setContextQuery] = useState("");

  const selectedProvider =
    availableProviders.find((provider) => provider.id === workspace.providerId) || availableProviders[0];
  const selectedCourses = state.courses.filter((course) => workspace.selectedCourseIds.includes(course.id));
  const selectedMode = chatModes.find((mode) => mode.id === workspace.mode) || chatModes[0];
  const visibleCourses = useMemo(() => {
    const query = contextQuery.trim().toLowerCase();

    if (!query) {
      return state.courses;
    }

    return state.courses.filter((course) =>
      [course.title, course.code, course.overview].join(" ").toLowerCase().includes(query)
    );
  }, [contextQuery, state.courses]);

  useEffect(() => {
    if (selectedProvider && workspace.providerId !== selectedProvider.id) {
      setWorkspace((current) => ({
        ...current,
        providerId: selectedProvider.id
      }));
    }
  }, [selectedProvider, workspace.providerId]);

  useEffect(() => {
    const persisted: StoredChatWorkspace = {
      providerId: workspace.providerId,
      mode: workspace.mode,
      selectedCourseIds: workspace.selectedCourseIds,
      messages: workspace.messages.map((message) => ({
        ...message,
        attachments: sanitizeAttachments(message.attachments || [])
      }))
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [workspace]);

  useEffect(() => {
    if (!isImmersive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImmersive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImmersive]);

  const toggleCourse = (courseId: string) =>
    setWorkspace((current) => ({
      ...current,
      selectedCourseIds: current.selectedCourseIds.includes(courseId)
        ? current.selectedCourseIds.filter((item) => item !== courseId)
        : [...current.selectedCourseIds, courseId]
    }));

  const addAttachments = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setError("");
    const nextAttachments: ChatAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const dataUrl = await fileToDataUrl(file);
        nextAttachments.push({
          id: `attachment-${crypto.randomUUID()}`,
          kind: "image",
          name: file.name,
          addedAt: new Date().toISOString(),
          excerpt: "Image attachment",
          image: {
            name: file.name,
            mimeType: file.type || "image/png",
            dataUrl,
            base64: dataUrl.split(",")[1] || ""
          }
        });
        continue;
      }

      const excerpt =
        (await extractTextPreview(file)) ||
        `Reference: ${file.name}. This quick attach can extract plain-text files directly. Add PDFs/slides to the Library screen for durable indexing and retrieval.`;

      nextAttachments.push({
        id: `attachment-${crypto.randomUUID()}`,
        kind: "text",
        name: file.name,
        addedAt: new Date().toISOString(),
        excerpt
      });
    }

    setComposerAttachments((current) => [...current, ...nextAttachments]);
    setStatus(
      `Attached ${nextAttachments.length} file${nextAttachments.length === 1 ? "" : "s"} to the next message.`
    );
  };

  const clearConversation = () => {
    setWorkspace((current) => ({
      ...current,
      messages: []
    }));
    setComposerAttachments([]);
    setDraft("");
    setError("");
    setStatus("Started a fresh conversation.");
  };

  const send = async (forcedPrompt?: string) => {
    const prompt = (forcedPrompt || draft).trim();

    if (!prompt && composerAttachments.length === 0) {
      return;
    }

    if (!selectedProvider) {
      setError("Enable and configure at least one chat-capable provider in AI settings first.");
      return;
    }

    const imageAttachments = composerAttachments.filter(
      (attachment) => attachment.kind === "image" && attachment.image
    );
    const textAttachments = composerAttachments.filter((attachment) => attachment.kind === "text");

    if (imageAttachments.length > 0 && !canAcceptImages(selectedProvider)) {
      setError(`${selectedProvider.name} cannot accept image input. Choose a provider with vision or multimodal capability.`);
      return;
    }

    setIsSending(true);
    setError("");
    setStatus("");

    const selectedContext = buildSelectedCoursesContext(state, workspace.selectedCourseIds);
    const textAttachmentContext = textAttachments.length
      ? [
          "Attached local references:",
          ...textAttachments.map(
            (attachment) => `File: ${attachment.name}\n${attachment.excerpt || ""}`
          )
        ].join("\n\n")
      : "";

    const systemPrompt = [
      selectedMode.systemPrompt,
      mathOutputInstruction,
      selectedContext ? `Active course context:\n${selectedContext}` : "",
      "When course context is active, use it aggressively but admit uncertainty if the context is incomplete."
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12_000);

    const fallbackPrompt = imageAttachments.length > 0 ? "Please analyze the attached image(s)." : "Use the attached references and continue helping me.";
    const userContent = [
      prompt || fallbackPrompt,
      textAttachmentContext
    ]
      .filter(Boolean)
      .join("\n\n");

    const userMessage: ChatMessage = {
      id: `chat-${crypto.randomUUID()}`,
      role: "user",
      content: userContent,
      createdAt: new Date().toISOString(),
      attachments: composerAttachments
    };

    const history: ProviderChatMessage[] = [
      ...workspace.messages.map((message) => ({
        role: message.role,
        content: message.content,
        images: message.attachments
          .filter((attachment) => attachment.kind === "image" && attachment.image)
          .map((attachment) => attachment.image as ProviderImageAttachment)
      })),
      {
        role: "user",
        content: userContent,
        images: imageAttachments.map((attachment) => attachment.image as ProviderImageAttachment)
      }
    ];

    try {
      const reply = await chatWithProvider({
        provider: selectedProvider,
        systemPrompt,
        messages: history
      });

      setWorkspace((current) => ({
        ...current,
        messages: [
          ...current.messages,
          userMessage,
          {
            id: `chat-${crypto.randomUUID()}`,
            role: "assistant",
            content: reply,
            createdAt: new Date().toISOString(),
            providerName: selectedProvider.name,
            attachments: []
          }
        ]
      }));
      setComposerAttachments([]);
      setDraft("");
      setStatus(`Replied with ${selectedProvider.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chat request failed.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`view chat-shell ${isImmersive ? "is-immersive" : ""}`}>
      {!embedded ? (
        <SectionHeader
          eyebrow="Chat"
          title="Talk to your models directly, with course context on demand."
          description="This is the main AI surface. Pick an enabled provider, attach course context only when you want it, send images or files, and drop into an immersive full-chat view when you want the interface to disappear."
        />
      ) : null}

      <section className="chat-layout">
        <div className="card chat-surface">
          <div className="chat-toolbar">
            <label className="field chat-provider-field">
              <span>Active provider</span>
              <select
                value={selectedProvider?.id || ""}
                onChange={(event) =>
                  setWorkspace((current) => ({
                    ...current,
                    providerId: event.target.value
                  }))
                }
              >
                {availableProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field chat-provider-field">
              <span>Mode</span>
              <select
                value={workspace.mode}
                onChange={(event) =>
                  setWorkspace((current) => ({
                    ...current,
                    mode: event.target.value as ChatMode
                  }))
                }
              >
                {chatModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="chat-toolbar-actions">
              <button
                className="secondary-button"
                onClick={() => setIsContextPickerOpen((current) => !current)}
                type="button"
              >
                {isContextPickerOpen ? "Hide context" : `Course context${selectedCourses.length > 0 ? ` (${selectedCourses.length})` : ""}`}
              </button>
              {onOpenSettings ? (
                <button className="secondary-button" onClick={onOpenSettings} type="button">
                  Model settings
                </button>
              ) : null}
              <button
                className="secondary-button"
                onClick={() => setIsImmersive((current) => !current)}
                type="button"
              >
                {isImmersive ? "Exit fullscreen" : "Enter fullscreen"}
              </button>
              <button className="secondary-button" onClick={clearConversation} type="button">
                New chat
              </button>
            </div>
          </div>

          {isContextPickerOpen ? (
            <div className="context-picker-card">
              <div className="task-card-row">
                <strong>Course context</strong>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setWorkspace((current) => ({
                      ...current,
                      selectedCourseIds: []
                    }))
                  }
                  type="button"
                >
                  Clear
                </button>
              </div>
              <label className="field">
                <span>Filter courses</span>
                <input
                  placeholder="Search by title, code, or overview"
                  value={contextQuery}
                  onChange={(event) => setContextQuery(event.target.value)}
                />
              </label>
              <div className="context-course-list">
                {visibleCourses.map((course) => (
                  <button
                    key={course.id}
                    className={`context-course-item ${
                      workspace.selectedCourseIds.includes(course.id) ? "is-selected-card" : ""
                    }`}
                    onClick={() => toggleCourse(course.id)}
                    type="button"
                  >
                    <strong>{course.title}</strong>
                    <small>
                      {course.code} • {course.materials.length} materials • {course.notes.length} notes
                    </small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="muted chat-context-summary">
            {selectedCourses.length > 0
              ? `Context attached: ${selectedCourses.map((course) => course.title).join(", ")}`
              : "No course context attached. The assistant will answer without library context until you add one."}
          </p>

          <div className="chat-history">
            {workspace.messages.length === 0 ? (
              <div className="chat-empty-state">
                <p className="recommendation-title">Start with a real question.</p>
                <p className="muted">
                  This chat is local-first. It uses the providers you configure in AI settings and does not require the Orbital cloud server.
                </p>
                <div className="suggestion-list">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="secondary-button chat-suggestion"
                      onClick={() => void send(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {workspace.messages.map((message) => (
              <div
                key={message.id}
                className={`chat-bubble ${message.role === "assistant" ? "is-assistant" : "is-user"}`}
              >
                <div className="chat-bubble-meta">
                  <strong>{message.role === "assistant" ? message.providerName || "Orbital" : "You"}</strong>
                  <small>{formatDateTime(message.createdAt)}</small>
                </div>
                <RichContent content={message.content} />
                {message.attachments.length > 0 ? (
                  <div className="attachment-gallery">
                    {message.attachments.map((attachment) =>
                      attachment.kind === "image" && attachment.image ? (
                        <figure key={attachment.id} className="attachment-card">
                          <img alt={attachment.name} src={attachment.image.dataUrl} />
                          <figcaption>{attachment.name}</figcaption>
                        </figure>
                      ) : (
                        <div key={attachment.id} className="attachment-card attachment-text-card">
                          <strong>{attachment.name}</strong>
                          <p>{attachment.excerpt}</p>
                        </div>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="chat-composer">
            {composerAttachments.length > 0 ? (
              <div className="attachment-gallery composer-attachments">
                {composerAttachments.map((attachment) =>
                  attachment.kind === "image" && attachment.image ? (
                    <figure key={attachment.id} className="attachment-card">
                      <img alt={attachment.name} src={attachment.image.dataUrl} />
                      <figcaption>{attachment.name}</figcaption>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setComposerAttachments((current) =>
                            current.filter((item) => item.id !== attachment.id)
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </figure>
                  ) : (
                    <div key={attachment.id} className="attachment-card attachment-text-card">
                      <div className="task-card-row">
                        <strong>{attachment.name}</strong>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            setComposerAttachments((current) =>
                              current.filter((item) => item.id !== attachment.id)
                            )
                          }
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      <p>{attachment.excerpt}</p>
                    </div>
                  )
                )}
              </div>
            ) : null}

            <label className="field">
              <span>Message</span>
              <textarea
                rows={5}
                placeholder="Ask anything, attach an image or file, or toggle one or more course tabs above to make the answer course-aware."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <div className="chat-composer-row">
              <label className="secondary-button file-button">
                Attach files or images
                <input
                  hidden
                  multiple
                  onChange={(event) => {
                    void addAttachments(event.target.files);
                    event.target.value = "";
                  }}
                  type="file"
                />
              </label>
              <button
                className="primary-button"
                disabled={isSending || (!draft.trim() && composerAttachments.length === 0)}
                onClick={() => void send()}
                type="button"
              >
                {isSending ? "Thinking..." : "Send"}
              </button>
            </div>
            {status ? <p className="muted">{status}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
            {availableProviders.length === 0 ? (
              <div className="note-card">
                <strong>No usable chat providers are enabled.</strong>
                <p className="error-text">
                  Enable a provider with a valid API key or local endpoint before sending messages.
                </p>
                {onOpenSettings ? (
                  <button className="secondary-button" onClick={onOpenSettings} type="button">
                    Open model settings
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack chat-sidepanel">
          <div className="card">
            <h2>Active context</h2>
            {selectedCourses.length === 0 ? (
              <p className="muted">No course tabs are active. This chat will behave like a general assistant until you toggle a course above.</p>
            ) : (
              <div className="note-list">
                {selectedCourses.map((course) => (
                  <div key={course.id} className="note-card">
                    <strong>{course.title}</strong>
                    <p>{course.overview}</p>
                    <small>
                      {course.lessons.length} lessons • {course.materials.length} materials • {course.notes.length} notes
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Multimodal notes</h2>
            <p className="muted">Image input works when the selected provider exposes vision or multimodal capability. Rich markdown, LaTeX, links, code blocks, emojis, and markdown images now render directly in chat output.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
