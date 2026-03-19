import {
  getCourseById,
  getGoalProgress,
  getSuggestedFocus,
  getTimeSummary,
  type AppState,
  type FocusMode
} from "@orbital/domain";
import { useEffect, useState, type Dispatch } from "react";

import { SectionHeader } from "../../components/SectionHeader";
import { clampPercent, formatCountdown, formatMinutes } from "../../lib/time";
import type { AppAction } from "../../lib/usePersistentAppState";

interface FocusCenterProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  embedded?: boolean;
}

interface FocusDraft {
  mode: FocusMode;
  durationMin: number;
  initialSeconds: number;
  remainingSeconds: number;
  selectedCourseId?: string;
  selectedTaskId?: string;
  selectedTagIds: string[];
  note: string;
  isRunning: boolean;
  sessionStartedAt: string | null;
  targetEndAt: string | null;
}

const STORAGE_KEY = "orbital-focus-draft-v1";
const durationOptions = [25, 50, 90];

const buildDraft = (recommendation: ReturnType<typeof getSuggestedFocus>): FocusDraft => ({
  mode: recommendation.suggestedMinutes <= 25 ? "pomodoro" : "deep",
  durationMin: recommendation.suggestedMinutes,
  initialSeconds: recommendation.suggestedMinutes * 60,
  remainingSeconds: recommendation.suggestedMinutes * 60,
  selectedCourseId: recommendation.courseId,
  selectedTaskId: recommendation.taskId,
  selectedTagIds: recommendation.tagIds,
  note: "",
  isRunning: false,
  sessionStartedAt: null,
  targetEndAt: null
});

const loadDraft = (recommendation: ReturnType<typeof getSuggestedFocus>): FocusDraft => {
  const fallback = buildDraft(recommendation);
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FocusDraft>;
    return {
      ...fallback,
      ...parsed,
      selectedTagIds: Array.isArray(parsed.selectedTagIds) ? parsed.selectedTagIds : fallback.selectedTagIds
    };
  } catch {
    return fallback;
  }
};

const persistDraft = (draft: FocusDraft) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
};

const resetDraft = (current: FocusDraft): FocusDraft => ({
  ...current,
  initialSeconds: current.durationMin * 60,
  remainingSeconds: current.durationMin * 60,
  note: "",
  isRunning: false,
  sessionStartedAt: null,
  targetEndAt: null
});

export const FocusCenter = ({ state, dispatch, embedded = false }: FocusCenterProps) => {
  const recommendation = getSuggestedFocus(state);
  const goalProgress = getGoalProgress(state);
  const summary = getTimeSummary(state);

  const [draft, setDraft] = useState<FocusDraft>(() => loadDraft(recommendation));

  const selectedTask = state.tasks.find((task) => task.id === draft.selectedTaskId);
  const selectedCourse = getCourseById(state, draft.selectedCourseId);

  useEffect(() => {
    persistDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!draft.isRunning || !draft.targetEndAt) {
      return;
    }

    const tick = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((new Date(draft.targetEndAt || "").getTime() - Date.now()) / 1_000)
      );

      setDraft((current) =>
        current.isRunning && current.remainingSeconds !== nextRemaining
          ? { ...current, remainingSeconds: nextRemaining }
          : current
      );
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [draft.isRunning, draft.targetEndAt]);

  const finalizeSession = (completedFullBlock = false) => {
    setDraft((current) => {
      if (!current.sessionStartedAt) {
        return current;
      }

      const spentSeconds = completedFullBlock
        ? current.initialSeconds
        : current.initialSeconds - current.remainingSeconds;
      const duration = Math.round(spentSeconds / 60);

      if (duration > 0) {
        dispatch({
          type: "logSession",
          session: {
            id: `session-${crypto.randomUUID()}`,
            startAt: current.sessionStartedAt,
            endAt: new Date().toISOString(),
            durationMin: duration,
            mode: current.mode,
            courseId: current.selectedCourseId,
            taskId: current.selectedTaskId,
            tagIds: current.selectedTagIds,
            note: current.note.trim() || undefined
          }
        });
      }

      return resetDraft(current);
    });
  };

  useEffect(() => {
    if (draft.isRunning && draft.remainingSeconds <= 0 && draft.sessionStartedAt) {
      finalizeSession(true);
    }
  }, [draft.isRunning, draft.remainingSeconds, draft.sessionStartedAt]);

  const startOrResume = () => {
    setDraft((current) => {
      const now = new Date();
      const sessionStartedAt = current.sessionStartedAt || now.toISOString();
      const secondsToRun = current.sessionStartedAt ? current.remainingSeconds : current.durationMin * 60;

      return {
        ...current,
        initialSeconds: current.sessionStartedAt ? current.initialSeconds : current.durationMin * 60,
        remainingSeconds: secondsToRun,
        sessionStartedAt,
        targetEndAt: new Date(now.getTime() + secondsToRun * 1_000).toISOString(),
        isRunning: true
      };
    });
  };

  const pause = () => {
    setDraft((current) => ({
      ...current,
      isRunning: false,
      targetEndAt: null
    }));
  };

  const loadRecommendation = () => {
    setDraft((current) => ({
      ...current,
      mode: recommendation.suggestedMinutes <= 25 ? "pomodoro" : "deep",
      durationMin: recommendation.suggestedMinutes,
      initialSeconds: recommendation.suggestedMinutes * 60,
      remainingSeconds: recommendation.suggestedMinutes * 60,
      selectedCourseId: recommendation.courseId,
      selectedTaskId: recommendation.taskId,
      selectedTagIds: recommendation.tagIds,
      note: current.sessionStartedAt ? current.note : ""
    }));
  };

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Focus"
          title="Attention before organization."
          description="Start the block first, then let the structure keep score. Every focus session can be attached to courses, tasks, and overlapping tag systems."
          aside={
            <button className="secondary-button" onClick={loadRecommendation} type="button">
              Load recommended block
            </button>
          }
        />
      ) : (
        <div className="action-row">
          <button className="secondary-button" onClick={loadRecommendation} type="button">
            Load recommended block
          </button>
        </div>
      )}

      <section className="hero-grid">
        <div className="card focus-hero">
          <p className="badge">
            {draft.mode === "pomodoro" ? "Pomodoro" : draft.mode === "deep" ? "Deep work" : "Sprint"}
          </p>
          <div className="countdown">{formatCountdown(draft.remainingSeconds)}</div>
          <p className="muted">
            {selectedCourse ? selectedCourse.title : "General focus"}
            {selectedTask ? ` • ${selectedTask.title}` : ""}
          </p>
          {draft.sessionStartedAt ? (
            <p className="muted">This timer persists while you move between tabs.</p>
          ) : null}

          <div className="chip-row">
            {durationOptions.map((option) => (
              <button
                key={option}
                className={`chip ${draft.durationMin === option ? "is-selected" : ""}`}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    durationMin: option,
                    initialSeconds: current.sessionStartedAt ? current.initialSeconds : option * 60,
                    remainingSeconds: current.sessionStartedAt ? current.remainingSeconds : option * 60
                  }))
                }
                type="button"
              >
                {option}m
              </button>
            ))}
            <label className="input-pill">
              <span>Custom</span>
              <input
                aria-label="Custom duration in minutes"
                min={5}
                max={240}
                type="number"
                value={draft.durationMin}
                onChange={(event) => {
                  const nextDuration = Number(event.target.value);
                  setDraft((current) => ({
                    ...current,
                    durationMin: nextDuration,
                    initialSeconds: current.sessionStartedAt ? current.initialSeconds : nextDuration * 60,
                    remainingSeconds: current.sessionStartedAt ? current.remainingSeconds : nextDuration * 60
                  }));
                }}
              />
            </label>
          </div>

          <div className="action-row">
            {!draft.isRunning ? (
              <button className="primary-button" onClick={startOrResume} type="button">
                {draft.sessionStartedAt ? "Resume session" : "Start focus"}
              </button>
            ) : (
              <button className="primary-button" onClick={pause} type="button">
                Pause
              </button>
            )}
            <button className="secondary-button" onClick={() => finalizeSession(false)} type="button">
              Log and stop
            </button>
          </div>
        </div>

        <div className="card control-panel">
          <h2>Session context</h2>
          <div className="field-grid">
            <label className="field">
              <span>Mode</span>
              <select
                value={draft.mode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    mode: event.target.value as FocusMode
                  }))
                }
              >
                <option value="pomodoro">Pomodoro</option>
                <option value="deep">Deep</option>
                <option value="sprint">Sprint</option>
              </select>
            </label>

            <label className="field">
              <span>Course</span>
              <select
                value={draft.selectedCourseId ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    selectedCourseId: event.target.value || undefined
                  }))
                }
              >
                <option value="">General</option>
                {state.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Task</span>
              <select
                value={draft.selectedTaskId ?? ""}
                onChange={(event) => {
                  const nextTaskId = event.target.value || undefined;
                  const task = state.tasks.find((item) => item.id === nextTaskId);
                  setDraft((current) => ({
                    ...current,
                    selectedTaskId: nextTaskId,
                    selectedCourseId: task?.courseId ?? current.selectedCourseId
                  }));
                }}
              >
                <option value="">No task attached</option>
                {state.tasks
                  .filter((task) => task.status !== "done")
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="tag-picker">
            {state.tags.map((tag) => (
              <button
                key={tag.id}
                className={`tag-toggle ${draft.selectedTagIds.includes(tag.id) ? "is-selected" : ""}`}
                style={{ borderColor: tag.color }}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    selectedTagIds: current.selectedTagIds.includes(tag.id)
                      ? current.selectedTagIds.filter((item) => item !== tag.id)
                      : [...current.selectedTagIds, tag.id]
                  }))
                }
                type="button"
              >
                {tag.label}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Session note</span>
            <textarea
              placeholder="What are you trying to accomplish in this block?"
              rows={3}
              value={draft.note}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  note: event.target.value
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="three-column-grid">
        <div className="card">
          <h2>Momentum</h2>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Today</span>
              <strong>{formatMinutes(summary.today)}</strong>
            </div>
            <div className="stat-card">
              <span>Week</span>
              <strong>{formatMinutes(summary.week)}</strong>
            </div>
            <div className="stat-card">
              <span>Month</span>
              <strong>{formatMinutes(summary.month)}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Suggested next move</h2>
          <p className="recommendation-title">{recommendation.title}</p>
          <p className="muted">{recommendation.reason}</p>
          <p className="recommendation-detail">Suggested block: {formatMinutes(recommendation.suggestedMinutes)}</p>
        </div>

        <div className="card">
          <h2>Goal alignment</h2>
          <div className="goal-list">
            {goalProgress.map((entry) => (
              <div key={entry.goal.id} className="goal-item">
                <div className="goal-item-row">
                  <strong>{entry.goal.title}</strong>
                  <span>{clampPercent(entry.completionRatio)}</span>
                </div>
                <div className="meter">
                  <span style={{ width: clampPercent(entry.completionRatio) }} />
                </div>
                <small>{formatMinutes(entry.completedMinutes)} logged so far</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
