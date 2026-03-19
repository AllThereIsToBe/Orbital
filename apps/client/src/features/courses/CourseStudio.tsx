import type {
  AppState,
  CourseChatMessage,
  CourseMaterialMeta,
  MaterialKind,
  Note
} from "@orbital/domain";
import { useState, type Dispatch } from "react";

import { RichContent } from "../../components/RichContent";
import { SectionHeader } from "../../components/SectionHeader";
import {
  extractTextPreview,
  readMaterialFile,
  saveMaterialFile
} from "../../lib/indexedDbFileStore";
import { formatDateTime } from "../../lib/time";
import type { AppAction } from "../../lib/usePersistentAppState";

interface CourseStudioProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  embedded?: boolean;
  server: {
    enabled: boolean;
    uploadMaterial: (material: CourseMaterialMeta, file: File) => Promise<void>;
    askCourse: (
      courseId: string,
      question: string,
      threadId?: string,
      providerId?: string
    ) => Promise<{ threadId: string; answer: string; citations: CourseChatMessage["citations"] }>;
    getChatMessages: (courseId: string, threadId: string) => Promise<CourseChatMessage[]>;
    openRawMaterial: (materialId: string) => Promise<void>;
  };
}

const materialKinds: MaterialKind[] = [
  "textbook",
  "slides",
  "syllabus",
  "exam",
  "assignment",
  "notes",
  "audio",
  "image",
  "text",
  "other"
];

export const CourseStudio = ({ state, dispatch, embedded = false, server }: CourseStudioProps) => {
  const [selectedCourseId, setSelectedCourseId] = useState(state.courses[0]?.id ?? "");
  const [materialKind, setMaterialKind] = useState<MaterialKind>("slides");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<CourseChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");

  const course = state.courses.find((item) => item.id === selectedCourseId);

  if (!course) {
    return null;
  }

  const query = libraryQuery.trim().toLowerCase();
  const filteredMaterials = course.materials.filter((material) =>
    [material.name, material.kind, material.extractedText || ""].join(" ").toLowerCase().includes(query)
  );
  const filteredNotes = course.notes.filter((note) =>
    [note.title, note.body].join(" ").toLowerCase().includes(query)
  );
  const filteredThreads = course.chats.filter((chat) =>
    [chat.title, chat.purpose].join(" ").toLowerCase().includes(query)
  );

  const uploadMaterial = async () => {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setStatusMessage("");

    try {
      const materialId = `material-${crypto.randomUUID()}`;
      const extractedText = await extractTextPreview(file);

      const material: CourseMaterialMeta = {
        id: materialId,
        courseId: course.id,
        lessonIds: selectedLessonId ? [selectedLessonId] : [],
        name: file.name,
        kind: materialKind,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
        tags: selectedTagIds,
        extractedText
      };

      if (server.enabled) {
        await server.uploadMaterial(material, file);
      } else {
        await saveMaterialFile(materialId, file);
        dispatch({ type: "addMaterial", material });
      }
      setFile(null);
      setSelectedLessonId("");
      setSelectedTagIds([]);
      setStatusMessage(
        server.enabled
          ? `Uploaded ${file.name} to the Orbital server and indexed it for retrieval.`
          : `Stored ${file.name} locally and linked it to ${course.title}.`
      );
    } catch (reason) {
      setStatusMessage(reason instanceof Error ? reason.message : "Material upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const addNote = () => {
    if (!noteTitle.trim() || !noteBody.trim()) {
      return;
    }

    const note: Note = {
      id: `note-${crypto.randomUUID()}`,
      courseId: course.id,
      createdAt: new Date().toISOString(),
      title: noteTitle.trim(),
      body: noteBody.trim(),
      linkedLessonIds: selectedLessonId ? [selectedLessonId] : []
    };

    dispatch({ type: "addNote", note });
    setNoteTitle("");
    setNoteBody("");
  };

  const openMaterial = async (materialId: string) => {
    if (server.enabled) {
      await server.openRawMaterial(materialId);
      return;
    }

    const storedFile = await readMaterialFile(materialId);

    if (!storedFile) {
      setStatusMessage("Raw file is not available in IndexedDB for this material.");
      return;
    }

    const url = URL.createObjectURL(storedFile);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const loadThread = async (threadId: string) => {
    setSelectedThreadId(threadId);

    if (!server.enabled) {
      setMessages([]);
      return;
    }

    setMessages(await server.getChatMessages(course.id, threadId));
  };

  const ask = async () => {
    if (!question.trim() || !server.enabled) {
      return;
    }

    setIsAsking(true);
    setStatusMessage("");

    try {
      const result = await server.askCourse(course.id, question.trim(), selectedThreadId);
      setSelectedThreadId(result.threadId);
      setMessages(await server.getChatMessages(course.id, result.threadId));
      setQuestion("");
      setStatusMessage("Course retrieval chat updated.");
    } catch (reason) {
      setStatusMessage(reason instanceof Error ? reason.message : "Unable to run course chat.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Library"
          title="Course library and setup."
          description="Keep raw source material, lesson structure, and notes organized here. Direct AI chat now lives in Chat, while this screen handles durable course setup and optional indexed retrieval."
        />
      ) : null}

      <section className="course-shell">
        <div className="course-sidebar">
          {state.courses.map((item) => (
            <button
              key={item.id}
              className={`course-select ${item.id === course.id ? "is-active" : ""}`}
              onClick={() => {
                setSelectedCourseId(item.id);
                setSelectedLessonId("");
                setSelectedThreadId(undefined);
                setMessages([]);
                setStatusMessage("");
              }}
              style={{ borderColor: item.accent }}
              type="button"
            >
              <strong>{item.title}</strong>
              <span>{item.code}</span>
            </button>
          ))}
        </div>

        <div className="course-main stack">
          <div className="card">
            <div className="course-hero">
              <div>
                <p className="badge">Course dashboard</p>
                <h2>{course.title}</h2>
                <p className="section-description">{course.overview}</p>
              </div>
              <div className="course-stats">
                <div>
                  <span>Lessons</span>
                  <strong>{course.lessons.length}</strong>
                </div>
                <div>
                  <span>Materials</span>
                  <strong>{course.materials.length}</strong>
                </div>
                <div>
                  <span>Notes</span>
                  <strong>{course.notes.length}</strong>
                </div>
              </div>
            </div>
            <label className="field">
              <span>Filter course library</span>
              <input
                placeholder="Search materials, notes, and retrieval threads"
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="two-column-grid">
            <div className="card">
              <h2>Lesson map</h2>
              <div className="lesson-list">
                {course.lessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-card">
                    <div className="lesson-card-row">
                      <strong>{lesson.title}</strong>
                      <span className={`status-pill status-${lesson.status}`}>{lesson.status}</span>
                    </div>
                    <small>Week {lesson.week}</small>
                    <ul>
                      {lesson.objectives.map((objective) => (
                        <li key={objective}>{objective}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="stack">
              <div className="card">
                <h2>Upload material</h2>
                <div className="field-grid single-column">
                  <label className="field">
                    <span>Kind</span>
                    <select
                      value={materialKind}
                      onChange={(event) => setMaterialKind(event.target.value as MaterialKind)}
                    >
                      {materialKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Link to lesson</span>
                    <select
                      value={selectedLessonId}
                      onChange={(event) => setSelectedLessonId(event.target.value)}
                    >
                      <option value="">No specific lesson</option>
                      {course.lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <input onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />

                  <div className="tag-picker">
                    {state.tags.map((tag) => (
                      <button
                        key={tag.id}
                        className={`tag-toggle ${selectedTagIds.includes(tag.id) ? "is-selected" : ""}`}
                        style={{ borderColor: tag.color }}
                        onClick={() =>
                          setSelectedTagIds((current) =>
                            current.includes(tag.id)
                              ? current.filter((item) => item !== tag.id)
                              : [...current, tag.id]
                          )
                        }
                        type="button"
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>

                  <button
                    className="primary-button"
                    disabled={!file || isUploading}
                    onClick={uploadMaterial}
                    type="button"
                  >
                    {isUploading ? "Uploading..." : "Store material"}
                  </button>
                  {statusMessage ? <p className="muted">{statusMessage}</p> : null}
                </div>
              </div>

              <div className="card">
                <h2>Saved retrieval threads</h2>
                <div className="chat-list">
                  {filteredThreads.map((chat) => (
                    <button
                      key={chat.id}
                      className={`chat-card ${selectedThreadId === chat.id ? "is-selected-card" : ""}`}
                      onClick={() => void loadThread(chat.id)}
                      type="button"
                    >
                      <strong>{chat.title}</strong>
                      <p className="muted">{chat.purpose}</p>
                      <small>Last active {formatDateTime(chat.lastActivityAt)}</small>
                    </button>
                  ))}
                  {filteredThreads.length === 0 ? <p className="muted">No retrieval threads match this filter.</p> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="two-column-grid">
            <div className="card">
              <h2>Raw materials</h2>
              <div className="material-list">
                {filteredMaterials.map((material) => (
                  <div key={material.id} className="material-card">
                    <div className="task-card-row">
                      <div>
                        <strong>{material.name}</strong>
                        <p className="muted">
                          {material.kind} • {(material.sizeBytes / 1_024).toFixed(1)} KB
                        </p>
                      </div>
                      <button className="secondary-button" onClick={() => openMaterial(material.id)} type="button">
                        Open raw
                      </button>
                    </div>
                    {material.extractedText ? <p className="material-preview">{material.extractedText}</p> : null}
                  </div>
                ))}
                {filteredMaterials.length === 0 ? <p className="muted">No materials match this filter.</p> : null}
              </div>
            </div>

            <div className="card">
              <h2>Notes and reflections</h2>
              <div className="field-grid single-column">
                <label className="field">
                  <span>Title</span>
                  <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
                </label>
                <label className="field">
                  <span>Body</span>
                  <textarea rows={5} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} />
                </label>
                <button className="primary-button" onClick={addNote} type="button">
                  Save note
                </button>
              </div>
              <div className="note-list">
                {filteredNotes.map((note) => (
                  <div key={note.id} className="note-card">
                    <strong>{note.title}</strong>
                    <p>{note.body}</p>
                  </div>
                ))}
                {filteredNotes.length === 0 ? <p className="muted">No notes match this filter.</p> : null}
              </div>
            </div>
          </div>

          <div className="two-column-grid">
            <div className="card">
              <h2>Optional cloud retrieval tutor</h2>
              <div className="field-grid single-column">
                <label className="field">
                  <span>Ask this indexed course library</span>
                  <textarea
                    rows={4}
                    placeholder="Use this only when you want server-backed retrieval across uploaded course materials."
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                </label>
                <button className="primary-button" disabled={!server.enabled || !question || isAsking} onClick={ask} type="button">
                  {isAsking ? "Thinking..." : "Ask indexed tutor"}
                </button>
                {!server.enabled ? (
                  <p className="muted">This part uses the optional Orbital cloud server for indexed retrieval over uploaded files. Direct API chat without login is in the Chat workspace.</p>
                ) : null}
              </div>
            </div>
            <div className="card">
              <h2>Thread transcript</h2>
              <div className="note-list">
                {messages.length === 0 ? <p className="muted">Select or start an indexed cloud thread to see messages and citations.</p> : null}
                {messages.map((message) => (
                  <div key={message.id} className="note-card">
                    <strong>{message.role === "assistant" ? "Orbital tutor" : "You"}</strong>
                    <RichContent content={message.content} />
                    {message.citations.length > 0 ? (
                      <div className="citation-list">
                        {message.citations.map((citation) => (
                          <small key={`${message.id}-${citation.materialId}`}>
                            {citation.materialName}: {citation.excerpt}
                          </small>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
