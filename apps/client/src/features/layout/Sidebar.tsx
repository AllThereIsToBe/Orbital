import type { GoalProgress, ScheduleSuggestion, TimeSummary, UserSummary } from "@orbital/domain";

import { clampPercent, formatMinutes } from "../../lib/time";

export type AppView = "learn" | "plan" | "insights" | "social";

interface SidebarProps {
  activeView: AppView;
  onOpenSettings: () => void;
  setActiveView: (view: AppView) => void;
  summary: TimeSummary;
  recommendation: ScheduleSuggestion;
  goals: GoalProgress[];
  connection: "checking" | "online" | "offline";
  user: UserSummary | null;
}

const navItems: Array<{ id: AppView; label: string; detail: string }> = [
  { id: "learn", label: "Learn", detail: "Chat, study, library, review" },
  { id: "plan", label: "Plan", detail: "Tasks, focus, calendar" },
  { id: "insights", label: "Insights", detail: "Progress and allocations" },
  { id: "social", label: "Social", detail: "Friends and leaderboards" }
];

export const Sidebar = ({
  activeView,
  onOpenSettings,
  setActiveView,
  summary,
  recommendation,
  goals,
  connection,
  user
}: SidebarProps) => (
  <aside className="sidebar">
    <div className="brand-mark">
      <div className="brand-chip">Orbital</div>
      <p className="brand-copy">Study OS for focused execution, durable memory, and AI-assisted learning.</p>
    </div>

    <nav className="nav-stack" aria-label="Primary">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${item.id === activeView ? "is-active" : ""}`}
          onClick={() => setActiveView(item.id)}
          type="button"
        >
          <span>{item.label}</span>
          <small>{item.detail}</small>
        </button>
      ))}
    </nav>

    <button className="secondary-button sidebar-settings-button" onClick={onOpenSettings} type="button">
      Settings and cloud
    </button>

    <section className="sidebar-panel">
      <p className="panel-label">Today</p>
      <strong>{formatMinutes(summary.today)}</strong>
      <span>{formatMinutes(summary.week)} this week</span>
    </section>

    <section className="sidebar-panel">
      <p className="panel-label">Cloud</p>
      <strong>{connection === "online" ? (user ? `Cloud: ${user.username}` : "Server ready") : connection}</strong>
      <span>{user ? "Optional server sync, indexed retrieval, calendar, and social features are available." : "Core chat and study work locally. Sign in only for optional cloud features."}</span>
    </section>

    <section className="sidebar-panel">
      <p className="panel-label">Suggested next block</p>
      <strong>{recommendation.title}</strong>
      <span>{recommendation.reason}</span>
    </section>

    <section className="sidebar-panel">
      <p className="panel-label">Goal pulse</p>
      <div className="goal-mini-list">
        {goals.map((entry) => (
          <div key={entry.goal.id} className="goal-mini">
            <div className="goal-mini-row">
              <span>{entry.goal.title}</span>
              <small>{clampPercent(entry.completionRatio)}</small>
            </div>
            <div className="meter">
              <span style={{ width: clampPercent(entry.completionRatio) }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  </aside>
);
