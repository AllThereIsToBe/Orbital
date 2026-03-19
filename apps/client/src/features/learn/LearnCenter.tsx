import {
  getFlashcardStats,
  type AppState,
  type CourseChatMessage,
  type CourseMaterialMeta
} from "@orbital/domain";
import { useMemo, useState, type Dispatch } from "react";

import { SectionHeader } from "../../components/SectionHeader";
import { ChatWorkspace } from "../chat/ChatWorkspace";
import { CourseStudio } from "../courses/CourseStudio";
import { ReviewCenter } from "../review/ReviewCenter";
import { StudyCenter } from "../study/StudyCenter";
import type { AppAction } from "../../lib/usePersistentAppState";

type LearnSurface = "assistant" | "study" | "library" | "review";

interface LearnCenterProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onOpenSettings: () => void;
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

const learnSurfaces: Array<{ id: LearnSurface; label: string; detail: string }> = [
  { id: "assistant", label: "Assistant", detail: "Direct AI work with course context, files, and images." },
  { id: "study", label: "Study output", detail: "Lesson walkthroughs, revision packs, and problem coaching." },
  { id: "library", label: "Library", detail: "Course materials, notes, and optional indexed retrieval." },
  { id: "review", label: "Review", detail: "Flashcards, due work, and spaced repetition coverage." }
];

export const LearnCenter = ({ state, dispatch, onOpenSettings, server }: LearnCenterProps) => {
  const [surface, setSurface] = useState<LearnSurface>("assistant");
  const [courseQuery, setCourseQuery] = useState("");

  const flashcardStats = getFlashcardStats(state);
  const activeSurface = learnSurfaces.find((entry) => entry.id === surface) || learnSurfaces[0];
  const filteredCourses = useMemo(
    () =>
      state.courses.filter((course) => {
        const query = courseQuery.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return [course.title, course.code, course.discipline, course.overview]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [courseQuery, state.courses]
  );

  return (
    <div className="view">
      <SectionHeader
        eyebrow="Learn"
        title="One workspace for asking, studying, filing, and retaining."
        description="The learning flow is consolidated here instead of being split across separate tabs. Switch surfaces when you need a different level of structure, not a different app."
        aside={
          <button className="secondary-button" onClick={onOpenSettings} type="button">
            Settings and cloud
          </button>
        }
      />

      <section className="workspace-shell">
        <aside className="workspace-sidebar">
          <div className="card workspace-spotlight">
            <p className="badge">Learning cockpit</p>
            <strong>{activeSurface.label}</strong>
            <p className="muted">{activeSurface.detail}</p>
            <div className="workspace-mini-stats">
              <div>
                <span>Courses</span>
                <strong>{state.courses.length}</strong>
              </div>
              <div>
                <span>Materials</span>
                <strong>{state.courses.reduce((total, course) => total + course.materials.length, 0)}</strong>
              </div>
              <div>
                <span>Due cards</span>
                <strong>{flashcardStats.due}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="task-card-row">
              <h2>Course filter</h2>
              <span className="muted">{filteredCourses.length} visible</span>
            </div>
            <label className="field">
              <span>Search courses</span>
              <input
                placeholder="Filter by title, code, discipline, or overview"
                value={courseQuery}
                onChange={(event) => setCourseQuery(event.target.value)}
              />
            </label>
            <div className="workspace-course-list">
              {filteredCourses.map((course) => (
                <div key={course.id} className="workspace-course-card" style={{ borderColor: course.accent }}>
                  <strong>{course.title}</strong>
                  <small>
                    {course.code} • {course.discipline}
                  </small>
                  <p className="muted">{course.overview}</p>
                  <small>
                    {course.lessons.length} lessons • {course.materials.length} materials • {course.notes.length} notes
                  </small>
                </div>
              ))}
              {filteredCourses.length === 0 ? (
                <p className="muted">No courses match this filter.</p>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="workspace-stage">
          <div className="card workspace-switcher-card">
            <div className="workspace-switcher-row">
              <label className="field workspace-select">
                <span>Learning surface</span>
                <select value={surface} onChange={(event) => setSurface(event.target.value as LearnSurface)}>
                  {learnSurfaces.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">{activeSurface.detail}</p>
            </div>
          </div>

          {surface === "assistant" ? (
            <ChatWorkspace embedded onOpenSettings={onOpenSettings} state={state} />
          ) : null}
          {surface === "study" ? (
            <StudyCenter embedded onOpenSettings={onOpenSettings} state={state} />
          ) : null}
          {surface === "library" ? (
            <CourseStudio dispatch={dispatch} embedded server={server} state={state} />
          ) : null}
          {surface === "review" ? (
            <ReviewCenter dispatch={dispatch} embedded state={state} />
          ) : null}
        </div>
      </section>
    </div>
  );
};
