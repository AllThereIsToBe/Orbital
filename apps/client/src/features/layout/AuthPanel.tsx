import { useState } from "react";

interface AuthPanelProps {
  connection: "checking" | "online" | "offline";
  user: { username: string } | null;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
}

export const AuthPanel = ({
  connection,
  user,
  onLogin,
  onRegister,
  onLogout
}: AuthPanelProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (connection !== "online") {
    return (
      <div className="card">
        <h2>Optional cloud features unavailable</h2>
        <p className="muted">Direct chat, study mode, focus tracking, review, and local library features still work. The Orbital server is only for optional sync, indexed retrieval across uploads, social features, and calendar import.</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="card">
        <h2>Cloud account connected</h2>
        <p className="muted">Connected as {user.username}. Cloud-only features such as sync, social, calendar import, and indexed retrieval are now available on top of the normal local-first app.</p>
        <button className="secondary-button" onClick={onLogout} type="button">
          Sign out
        </button>
      </div>
    );
  }

  const submit = async () => {
    setIsLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await onLogin(username, password);
      } else {
        await onRegister(username, password);
      }
      setUsername("");
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="task-card-row">
        <h2>{mode === "login" ? "Optional cloud account" : "Create cloud account"}</h2>
        <div className="chip-row">
          <button className={`chip ${mode === "login" ? "is-selected" : ""}`} onClick={() => setMode("login")} type="button">
            Login
          </button>
          <button className={`chip ${mode === "register" ? "is-selected" : ""}`} onClick={() => setMode("register")} type="button">
            Register
          </button>
        </div>
      </div>
      <p className="muted">You do not need this for direct API chat or local-only use. It only unlocks sync, indexed retrieval over uploaded materials, social features, and calendar import.</p>
      <div className="field-grid single-column">
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={isLoading} onClick={submit} type="button">
          {isLoading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
    </div>
  );
};
