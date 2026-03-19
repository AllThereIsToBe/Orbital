import type { Friendship, LeaderboardEntry, UserSummary } from "@orbital/domain";
import { useMemo, useState } from "react";

import { SectionHeader } from "../../components/SectionHeader";
import { formatMinutes } from "../../lib/time";

interface SocialHubProps {
  canSync: boolean;
  currentUser: UserSummary | null;
  friendships: Friendship[];
  leaderboard: LeaderboardEntry[];
  requestFriend: (username: string) => Promise<void>;
  acceptFriend: (friendshipId: string) => Promise<void>;
  refreshLeaderboard: (windowName: string, tagId?: string) => Promise<void>;
}

export const SocialHub = ({
  canSync,
  currentUser,
  friendships,
  leaderboard,
  requestFriend,
  acceptFriend,
  refreshLeaderboard
}: SocialHubProps) => {
  const [username, setUsername] = useState("");
  const [windowName, setWindowName] = useState("week");
  const [error, setError] = useState("");

  const pendingIncoming = useMemo(
    () =>
      friendships.filter(
        (item) => item.status === "pending" && item.target.id === currentUser?.id
      ),
    [friendships, currentUser]
  );

  const sendRequest = async () => {
    setError("");
    try {
      await requestFriend(username);
      setUsername("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send friend request.");
    }
  };

  const updateWindow = async (nextWindow: string) => {
    setWindowName(nextWindow);
    try {
      await refreshLeaderboard(nextWindow);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh leaderboard.");
    }
  };

  return (
    <div className="view">
      <SectionHeader
        eyebrow="Social"
        title="Competition and shared momentum, without losing signal."
        description="Friend-based study tracking and filterable leaderboards turn consistency into something visible."
      />
      <section className="two-column-grid">
        <div className="stack">
          <div className="card">
            <h2>Friends</h2>
            {!canSync ? <p className="muted">Sign in to use collaborative features.</p> : null}
            <div className="field-grid single-column">
              <label className="field">
                <span>Add friend by username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              {error ? <p className="error-text">{error}</p> : null}
              <button className="primary-button" disabled={!canSync || !username} onClick={sendRequest} type="button">
                Send request
              </button>
            </div>
          </div>
          <div className="card">
            <h2>Requests waiting on you</h2>
            <div className="task-list">
              {pendingIncoming.length === 0 ? <p className="muted">No pending friend requests.</p> : null}
              {pendingIncoming.map((item) => (
                <div key={item.id} className="task-card">
                  <strong>{item.requester.username}</strong>
                  <p className="muted">Requested on {new Date(item.createdAt).toLocaleDateString()}</p>
                  <button className="primary-button" disabled={!canSync} onClick={() => void acceptFriend(item.id)} type="button">
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="task-card-row">
            <h2>Leaderboard</h2>
            <div className="chip-row">
              {["today", "week", "month", "year", "lifetime"].map((value) => (
                <button
                  key={value}
                  className={`chip ${windowName === value ? "is-selected" : ""}`}
                  onClick={() => void updateWindow(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="task-list">
            {leaderboard.map((entry, index) => (
              <div key={entry.userId} className="task-card">
                <div className="task-card-row">
                  <strong>#{index + 1}</strong>
                  <span>{entry.userId === currentUser?.id ? currentUser.username : entry.username || entry.userId.slice(0, 8)}</span>
                </div>
                <p className="recommendation-title">{formatMinutes(entry.minutes)}</p>
              </div>
            ))}
            {leaderboard.length === 0 ? <p className="muted">No synced focus sessions for this filter yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
};
