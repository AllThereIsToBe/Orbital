import type { CalendarEvent } from "@orbital/domain";
import { useState } from "react";

import { SectionHeader } from "../../components/SectionHeader";
import { formatDateTime } from "../../lib/time";

interface CalendarBoardProps {
  events: CalendarEvent[];
  canSync: boolean;
  importCalendar: (name: string, icsText: string) => Promise<void>;
  embedded?: boolean;
}

export const CalendarBoard = ({ events, canSync, importCalendar, embedded = false }: CalendarBoardProps) => {
  const [name, setName] = useState("Semester calendar");
  const [icsText, setIcsText] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    setIsLoading(true);
    setError("");

    try {
      await importCalendar(name, icsText);
      setIcsText("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Calendar import failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Calendar"
          title="Pull deadlines and lectures into the same operating system."
          description="ICS import gives the planner and study engine a real schedule instead of isolated task lists."
        />
      ) : null}
      <section className="two-column-grid">
        <div className="card">
          <h2>Import ICS</h2>
          <div className="field-grid single-column">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              <span>ICS text</span>
              <textarea
                rows={10}
                placeholder="Paste a Canvas or calendar ICS export here."
                value={icsText}
                onChange={(event) => setIcsText(event.target.value)}
              />
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="primary-button" disabled={!canSync || !icsText || isLoading} onClick={handleImport} type="button">
              {isLoading ? "Importing..." : "Import calendar"}
            </button>
            {!canSync ? <p className="muted">Sign in to the Orbital server to enable calendar sync.</p> : null}
          </div>
        </div>
        <div className="card">
          <h2>Upcoming events</h2>
          <div className="task-list">
            {events.length === 0 ? <p className="muted">No calendar events imported yet.</p> : null}
            {events.map((event) => (
              <div key={event.id} className="task-card">
                <strong>{event.title}</strong>
                <p className="muted">{formatDateTime(event.startAt)}</p>
                {event.description ? <p>{event.description}</p> : null}
                {event.location ? <small>{event.location}</small> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
