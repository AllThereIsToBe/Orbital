import type { AppState } from "@orbital/domain";
import { useEffect, useMemo, useState } from "react";

import { RichContent } from "../../components/RichContent";
import { SectionHeader } from "../../components/SectionHeader";
import { buildLessonContextSummary } from "../../lib/courseContext";
import { chatWithProvider, getChatCapableProviders } from "../../lib/openAiCompatible";
import { formatDateTime } from "../../lib/time";

type StudyMode = "guided" | "map" | "problems" | "revision";

interface StudyCenterProps {
  state: AppState;
  embedded?: boolean;
  onOpenSettings?: () => void;
}

const mathOutputInstruction =
  "When you use formulas, write inline math as $...$ and display math as $$...$$. Never output raw LaTeX commands or bare equations without markdown math delimiters.";

const studyModes: Array<{
  id: StudyMode;
  label: string;
  description: string;
  systemPrompt: string;
  userPrompt: (context: string, learnerNeed: string) => string;
}> = [
  {
    id: "guided",
    label: "Guided walkthrough",
    description: "Teach the lesson in sequence, with checkpoints and active questions.",
    systemPrompt:
      `You are a rigorous academic tutor. Teach the lesson as a guided progression with clear checkpoints, active recall questions, and no hand-wavy leaps.\n\n${mathOutputInstruction}`,
    userPrompt: (context, learnerNeed) =>
      `Teach this lesson as a guided walkthrough.\n\nLesson context:\n${context}\n\nCurrent learner need:\n${learnerNeed || "Start from the right entry point and walk me through it."}`
  },
  {
    id: "map",
    label: "Lecture map",
    description: "Turn the lesson into a practical route through lecture, chapter, and supporting materials.",
    systemPrompt:
      `You are a study strategist. Convert lesson material into a sane progression path through concepts, sources, and next actions.\n\n${mathOutputInstruction}`,
    userPrompt: (context, learnerNeed) =>
      `Build a study map for this lesson.\n\nLesson context:\n${context}\n\nCurrent learner need:\n${learnerNeed || "Show me what to tackle first, second, and third."}`
  },
  {
    id: "problems",
    label: "Problem-set coach",
    description: "Focus on representative problems, setup discipline, and likely mistakes.",
    systemPrompt:
      `You are a demanding engineering problem coach. Focus on setup, assumptions, equations, and why each step matters.\n\n${mathOutputInstruction}`,
    userPrompt: (context, learnerNeed) =>
      `Coach me through the problem-solving side of this lesson.\n\nLesson context:\n${context}\n\nCurrent learner need:\n${learnerNeed || "Pick representative problem types and train me through them."}`
  },
  {
    id: "revision",
    label: "Revision pack",
    description: "Compress the lesson into formulas, pitfalls, and retrieval prompts.",
    systemPrompt:
      `You are building an exam-oriented revision pack. Compress without becoming vague, and end with active recall prompts.\n\n${mathOutputInstruction}`,
    userPrompt: (context, learnerNeed) =>
      `Generate a revision pack for this lesson.\n\nLesson context:\n${context}\n\nCurrent learner need:\n${learnerNeed || "Prioritize what would matter most in revision or exams."}`
  }
];

export const StudyCenter = ({ state, embedded = false, onOpenSettings }: StudyCenterProps) => {
  const availableProviders = useMemo(() => getChatCapableProviders(state.providers), [state.providers]);
  const [selectedCourseId, setSelectedCourseId] = useState(state.courses[0]?.id ?? "");
  const [selectedLessonId, setSelectedLessonId] = useState(state.courses[0]?.lessons[0]?.id ?? "");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [learnerNeed, setLearnerNeed] = useState("");
  const [activeMode, setActiveMode] = useState<StudyMode>("guided");
  const [lessonQuery, setLessonQuery] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const selectedCourse = state.courses.find((course) => course.id === selectedCourseId) || state.courses[0];
  const selectedLesson =
    selectedCourse?.lessons.find((lesson) => lesson.id === selectedLessonId) || selectedCourse?.lessons[0];
  const selectedMode = studyModes.find((mode) => mode.id === activeMode) || studyModes[0];
  const selectedProvider =
    availableProviders.find((provider) => provider.id === selectedProviderId) || availableProviders[0];
  const visibleLessons = selectedCourse?.lessons.filter((lesson) => {
    const query = lessonQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [lesson.title, ...lesson.objectives].join(" ").toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!selectedCourse) {
      return;
    }

    if (!selectedCourse.lessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(selectedCourse.lessons[0]?.id ?? "");
    }
  }, [selectedCourse, selectedLessonId]);

  useEffect(() => {
    if (selectedProvider && selectedProviderId !== selectedProvider.id) {
      setSelectedProviderId(selectedProvider.id);
    }
  }, [selectedProvider, selectedProviderId]);

  const runMode = async (forcedMode?: StudyMode, forcedLearnerNeed?: string) => {
    if (!selectedCourse || !selectedLesson) {
      setError("Pick a course and lesson first.");
      return;
    }

    if (!selectedProvider) {
      setError("Enable and configure at least one provider in AI settings first.");
      return;
    }

    const mode = studyModes.find((entry) => entry.id === (forcedMode || activeMode)) || selectedMode;
    const context = buildLessonContextSummary(selectedCourse, selectedLesson);
    const learnerNeedText = (forcedLearnerNeed || learnerNeed).trim();

    setIsRunning(true);
    setError("");
    setStatus("");

    try {
      const response = await chatWithProvider({
        provider: selectedProvider,
        systemPrompt: mode.systemPrompt,
        messages: [
          {
            role: "user",
            content: mode.userPrompt(context, learnerNeedText)
          }
        ]
      });

      setOutput(response);
      setStatus(`Generated with ${selectedProvider.name} at ${formatDateTime(new Date().toISOString())}.`);
      if (forcedMode) {
        setActiveMode(forcedMode);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Study run failed.");
    } finally {
      setIsRunning(false);
    }
  };

  if (!selectedCourse || !selectedLesson) {
    return null;
  }

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Study"
          title="Enter a course through lessons, not through clutter."
          description="Choose the course, jump into a lesson, and then decide whether you need a walkthrough, a problem coach, a revision pack, or a cleaner study map."
        />
      ) : null}

      <section className="study-layout">
        <div className="card study-outline">
          <div className="task-card-row">
            <h2>Course outline</h2>
            <label className="field study-filter">
              <span>Course</span>
              <select value={selectedCourse.id} onChange={(event) => setSelectedCourseId(event.target.value)}>
                {state.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Filter lessons</span>
            <input
              placeholder="Search lesson title or objective"
              value={lessonQuery}
              onChange={(event) => setLessonQuery(event.target.value)}
            />
          </label>

          <div className="lesson-list">
            {visibleLessons?.map((lesson) => (
              <button
                key={lesson.id}
                className={`lesson-card lesson-select ${lesson.id === selectedLesson.id ? "is-selected-card" : ""}`}
                onClick={() => setSelectedLessonId(lesson.id)}
                type="button"
              >
                <div className="lesson-card-row">
                  <strong>{lesson.title}</strong>
                  <span className={`status-pill status-${lesson.status}`}>{lesson.status}</span>
                </div>
                <small>Week {lesson.week}</small>
                <p className="muted">{lesson.objectives[0] || "No objectives yet."}</p>
              </button>
            ))}
            {visibleLessons?.length === 0 ? <p className="muted">No lessons match this filter.</p> : null}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="course-hero">
              <div>
                <p className="badge">Current lesson</p>
                <h2>{selectedLesson.title}</h2>
                <p className="section-description">{selectedCourse.overview}</p>
              </div>
              <div className="course-stats">
                <div>
                  <span>Week</span>
                  <strong>{selectedLesson.week}</strong>
                </div>
                <div>
                  <span>Materials</span>
                  <strong>
                    {
                      selectedCourse.materials.filter(
                        (material) =>
                          material.lessonIds.length === 0 || material.lessonIds.includes(selectedLesson.id)
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <span>Notes</span>
                  <strong>
                    {
                      selectedCourse.notes.filter(
                        (note) =>
                          note.linkedLessonIds.length === 0 || note.linkedLessonIds.includes(selectedLesson.id)
                      ).length
                    }
                  </strong>
                </div>
              </div>
            </div>

            <div className="lesson-objectives">
              {selectedLesson.objectives.map((objective) => (
                <div key={objective} className="note-card">
                  <strong>Objective</strong>
                  <p>{objective}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="task-card-row">
              <h2>Generate study output</h2>
              {onOpenSettings ? (
                <button className="secondary-button" onClick={onOpenSettings} type="button">
                  Model settings
                </button>
              ) : null}
            </div>

            <div className="field-grid">
              <label className="field study-provider-field">
                <span>Provider</span>
                <select
                  value={selectedProvider?.id || ""}
                  onChange={(event) => setSelectedProviderId(event.target.value)}
                >
                  {availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Mode</span>
                <select
                  value={activeMode}
                  onChange={(event) => setActiveMode(event.target.value as StudyMode)}
                >
                  {studyModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="muted">{selectedMode.description}</p>

            <label className="field">
              <span>What do you need right now?</span>
              <textarea
                rows={4}
                placeholder="Example: I understand the definitions but not how to attack the actual problems."
                value={learnerNeed}
                onChange={(event) => setLearnerNeed(event.target.value)}
              />
            </label>

            <div className="action-row">
              <button className="primary-button" disabled={isRunning} onClick={() => void runMode()} type="button">
                {isRunning ? "Building..." : `Run ${selectedMode.label.toLowerCase()}`}
              </button>
            </div>

            {status ? <p className="muted">{status}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
            {availableProviders.length === 0 ? (
              <div className="note-card">
                <strong>No usable providers are enabled.</strong>
                <p className="error-text">Enable a direct API or local model before generating study output.</p>
                {onOpenSettings ? (
                  <button className="secondary-button" onClick={onOpenSettings} type="button">
                    Open model settings
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2>Study output</h2>
            <div className="output-panel study-output-panel">
              {output ? (
                <RichContent content={output} />
              ) : (
                "Choose a lesson and a study mode to generate a guided walkthrough, problem coach, revision pack, or study map."
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
