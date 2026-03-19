import {
  getGoalProgress,
  getMinutesByCourse,
  getMinutesByTag,
  getTimeSummary,
  type AppState
} from "@orbital/domain";

import { SectionHeader } from "../../components/SectionHeader";
import { clampPercent, formatMinutes } from "../../lib/time";

interface AnalyticsViewProps {
  state: AppState;
  embedded?: boolean;
}

export const AnalyticsView = ({ state, embedded = false }: AnalyticsViewProps) => {
  const summary = getTimeSummary(state);
  const minutesByCourse = getMinutesByCourse(state).sort((left, right) => right.minutes - left.minutes);
  const minutesByTag = getMinutesByTag(state)
    .filter((entry) => entry.minutes > 0)
    .sort((left, right) => right.minutes - left.minutes);
  const goalProgress = getGoalProgress(state).sort((left, right) => right.completedMinutes - left.completedMinutes);
  const maxCourseMinutes = Math.max(...minutesByCourse.map((entry) => entry.minutes), 1);
  const maxTagMinutes = Math.max(...minutesByTag.map((entry) => entry.minutes), 1);

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Analytics"
          title="See effort allocation before it quietly drifts."
          description="The system keeps time by course, tag, task, and long-term ambition so your schedule and identity stay aligned."
        />
      ) : null}

      <section className="stat-grid large">
        <div className="stat-card">
          <span>Today</span>
          <strong>{formatMinutes(summary.today)}</strong>
        </div>
        <div className="stat-card">
          <span>This week</span>
          <strong>{formatMinutes(summary.week)}</strong>
        </div>
        <div className="stat-card">
          <span>This month</span>
          <strong>{formatMinutes(summary.month)}</strong>
        </div>
        <div className="stat-card">
          <span>Lifetime</span>
          <strong>{formatMinutes(summary.lifetime)}</strong>
        </div>
      </section>

      <section className="two-column-grid">
        <div className="card">
          <h2>Course distribution</h2>
          <div className="bar-list">
            {minutesByCourse.map((entry) => (
              <div key={entry.courseId} className="bar-row">
                <div className="bar-copy">
                  <strong>{entry.title}</strong>
                  <span>{formatMinutes(entry.minutes)}</span>
                </div>
                <div className="bar-track">
                  <span style={{ width: clampPercent(entry.minutes / maxCourseMinutes) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Tag distribution</h2>
          <div className="bar-list">
            {minutesByTag.map((entry) => (
              <div key={entry.tagId} className="bar-row">
                <div className="bar-copy">
                  <strong>{entry.label}</strong>
                  <span>{formatMinutes(entry.minutes)}</span>
                </div>
                <div className="bar-track">
                  <span style={{ width: clampPercent(entry.minutes / maxTagMinutes) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Goal progress</h2>
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
              <small>
                {formatMinutes(entry.completedMinutes)} of {formatMinutes(entry.goal.targetMinutes)}
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
