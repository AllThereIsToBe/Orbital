import type { AppState, CalendarEvent } from "@orbital/domain";
import { useState, type Dispatch } from "react";

import { SectionHeader } from "../../components/SectionHeader";
import { CalendarBoard } from "../calendar/CalendarBoard";
import { FocusCenter } from "../focus/FocusCenter";
import { TaskBoard } from "../tasks/TaskBoard";
import type { AppAction } from "../../lib/usePersistentAppState";

type PlanSurface = "tasks" | "focus" | "calendar";

interface PlanCenterProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  events: CalendarEvent[];
  canSync: boolean;
  importCalendar: (name: string, icsText: string) => Promise<void>;
}

const planSurfaces: Array<{ id: PlanSurface; label: string; detail: string }> = [
  { id: "tasks", label: "Tasks", detail: "Backlog, priorities, and realistic next blocks." },
  { id: "focus", label: "Focus", detail: "Timers, logged work, and active sessions." },
  { id: "calendar", label: "Calendar", detail: "ICS imports and upcoming hard dates." }
];

export const PlanCenter = ({
  state,
  dispatch,
  events,
  canSync,
  importCalendar
}: PlanCenterProps) => {
  const [surface, setSurface] = useState<PlanSurface>("tasks");
  const activeSurface = planSurfaces.find((entry) => entry.id === surface) || planSurfaces[0];
  const upcomingTasks = state.tasks.filter((task) => task.status !== "done").slice(0, 4);

  return (
    <div className="view">
      <SectionHeader
        eyebrow="Plan"
        title="Execution, time, and deadlines in one lane."
        description="Tasks, focus sessions, and calendar imports now share one planning surface so the schedule can tighten around real work instead of isolated tabs."
      />

      <section className="workspace-shell">
        <aside className="workspace-sidebar">
          <div className="card workspace-spotlight">
            <p className="badge">Planning surface</p>
            <strong>{activeSurface.label}</strong>
            <p className="muted">{activeSurface.detail}</p>
            <div className="workspace-mini-stats">
              <div>
                <span>Open tasks</span>
                <strong>{state.tasks.filter((task) => task.status !== "done").length}</strong>
              </div>
              <div>
                <span>Sessions</span>
                <strong>{state.sessions.length}</strong>
              </div>
              <div>
                <span>Events</span>
                <strong>{events.length}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Next commitments</h2>
            <div className="workspace-course-list">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="workspace-course-card">
                  <strong>{task.title}</strong>
                  <small>{task.status.replace("_", " ")}</small>
                </div>
              ))}
              {upcomingTasks.length === 0 ? (
                <p className="muted">Nothing queued right now.</p>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="workspace-stage">
          <div className="card workspace-switcher-card">
            <div className="workspace-switcher-row">
              <label className="field workspace-select">
                <span>Planning surface</span>
                <select value={surface} onChange={(event) => setSurface(event.target.value as PlanSurface)}>
                  {planSurfaces.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">{activeSurface.detail}</p>
            </div>
          </div>

          {surface === "tasks" ? <TaskBoard dispatch={dispatch} embedded state={state} /> : null}
          {surface === "focus" ? <FocusCenter dispatch={dispatch} embedded state={state} /> : null}
          {surface === "calendar" ? (
            <CalendarBoard canSync={canSync} embedded events={events} importCalendar={importCalendar} />
          ) : null}
        </div>
      </section>
    </div>
  );
};
