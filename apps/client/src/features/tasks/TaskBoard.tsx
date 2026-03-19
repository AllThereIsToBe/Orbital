import { buildScheduleSuggestions, getUpcomingTasks, type AppState, type Task } from "@orbital/domain";
import { useState, type Dispatch } from "react";

import { SectionHeader } from "../../components/SectionHeader";
import { formatDateTime, formatMinutes, toDateTimeInputValue } from "../../lib/time";
import type { AppAction } from "../../lib/usePersistentAppState";

interface TaskBoardProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  embedded?: boolean;
}

export const TaskBoard = ({ state, dispatch, embedded = false }: TaskBoardProps) => {
  const tasks = getUpcomingTasks(state);
  const suggestions = buildScheduleSuggestions(state);

  const [title, setTitle] = useState("");
  const [estimateMin, setEstimateMin] = useState(50);
  const [dueAt, setDueAt] = useState(toDateTimeInputValue(new Date(Date.now() + 86_400_000)));
  const [courseId, setCourseId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const addTask = () => {
    if (!title.trim()) {
      return;
    }

    const task: Task = {
      id: `task-${crypto.randomUUID()}`,
      title: title.trim(),
      status: "todo",
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      courseId: courseId || undefined,
      estimateMin,
      energy: estimateMin >= 90 ? "high" : estimateMin >= 50 ? "medium" : "low",
      priority: courseId ? 7 : 5,
      tags: selectedTagIds,
      focusMinutesLogged: 0
    };

    dispatch({ type: "addTask", task });
    setTitle("");
    setSelectedTagIds([]);
  };

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Tasks"
          title="Planning that survives contact with reality."
          description="Tasks, goals, and study blocks all live in the same system so execution data continuously improves prioritization."
        />
      ) : null}

      <section className="two-column-grid">
        <div className="card">
          <h2>Priority lane</h2>
          <div className="task-list">
            {tasks.map((task) => {
              const course = state.courses.find((item) => item.id === task.courseId);
              return (
                <div key={task.id} className="task-card">
                  <div className="task-card-row">
                    <div>
                      <strong>{task.title}</strong>
                      <p className="muted">
                        {course ? `${course.title} • ` : ""}
                        {formatMinutes(task.focusMinutesLogged)} logged / {formatMinutes(task.estimateMin)} estimated
                      </p>
                    </div>
                    <span className={`status-pill status-${task.status}`}>{task.status.replace("_", " ")}</span>
                  </div>

                  <div className="task-meta-row">
                    <span>Due {formatDateTime(task.dueAt)}</span>
                    <span>Priority {task.priority}/10</span>
                  </div>

                  <div className="task-actions">
                    <button
                      className="secondary-button"
                      onClick={() => dispatch({ type: "setTaskStatus", taskId: task.id, status: "todo" })}
                      type="button"
                    >
                      Todo
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        dispatch({ type: "setTaskStatus", taskId: task.id, status: "in_progress" })
                      }
                      type="button"
                    >
                      In progress
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => dispatch({ type: "setTaskStatus", taskId: task.id, status: "done" })}
                      type="button"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Add task</h2>
            <div className="field-grid single-column">
              <label className="field">
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Estimate</span>
                  <input
                    min={15}
                    step={5}
                    type="number"
                    value={estimateMin}
                    onChange={(event) => setEstimateMin(Number(event.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Due</span>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>Course</span>
                <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                  <option value="">General</option>
                  {state.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

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

              <button className="primary-button" onClick={addTask} type="button">
                Add task
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Recommended plan</h2>
            <div className="suggestion-list">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="suggestion-card">
                  <strong>{suggestion.title}</strong>
                  <p className="muted">{suggestion.reason}</p>
                  <small>Suggested block: {formatMinutes(suggestion.suggestedMinutes)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
