import type { AppState, UserSummary, WorkflowRunResult } from "@orbital/domain";
import { useEffect, useState, type Dispatch } from "react";

import { AuthPanel } from "./AuthPanel";
import { AIControlCenter } from "../ai/AIControlCenter";
import { SettingsCenter } from "../settings/SettingsCenter";
import type { AppearancePreferences } from "../../lib/useAppearancePreferences";
import type { AppAction } from "../../lib/usePersistentAppState";

type SettingsTab = "appearance" | "ai" | "cloud";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: AppearancePreferences;
  updatePreferences: (patch: Partial<AppearancePreferences>) => void;
  resetPreferences: () => void;
  state: AppState;
  dispatch: Dispatch<AppAction>;
  runServerWorkflow?: (
    workflowId: string,
    courseId: string | undefined,
    userBrief: string
  ) => Promise<WorkflowRunResult>;
  canUseServer: boolean;
  connection: "checking" | "online" | "offline";
  user: UserSummary | null;
  auth: {
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
  };
  cloudSync: {
    pushLocalState: () => Promise<void>;
    pullCloudState: () => Promise<void>;
  };
}

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "appearance", label: "Appearance" },
  { id: "ai", label: "AI" },
  { id: "cloud", label: "Cloud" }
];

export const SettingsDrawer = ({
  isOpen,
  onClose,
  preferences,
  updatePreferences,
  resetPreferences,
  state,
  dispatch,
  runServerWorkflow,
  canUseServer,
  connection,
  user,
  auth,
  cloudSync
}: SettingsDrawerProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [busyAction, setBusyAction] = useState<"push" | "pull" | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const runCloudAction = async (action: "push" | "pull") => {
    setBusyAction(action);
    setCloudError("");
    setCloudStatus("");

    try {
      if (action === "push") {
        await cloudSync.pushLocalState();
        setCloudStatus("Pushed the current local state to the Orbital cloud snapshot.");
      } else {
        await cloudSync.pullCloudState();
        setCloudStatus("Pulled the latest cloud snapshot down to this device.");
      }
    } catch (reason) {
      setCloudError(reason instanceof Error ? reason.message : "Cloud sync failed.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label="Settings and cloud drawer"
        className="settings-drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="drawer-header">
          <div>
            <p className="panel-label">Settings</p>
            <h2>System controls</h2>
          </div>
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="drawer-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`chip ${activeTab === tab.id ? "is-selected" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {activeTab === "appearance" ? (
            <SettingsCenter
              embedded
              preferences={preferences}
              resetPreferences={resetPreferences}
              updatePreferences={updatePreferences}
            />
          ) : null}

          {activeTab === "ai" ? (
            <AIControlCenter
              canUseServer={canUseServer}
              dispatch={dispatch}
              embedded
              runServerWorkflow={runServerWorkflow}
              state={state}
            />
          ) : null}

          {activeTab === "cloud" ? (
            <div className="stack">
              <AuthPanel
                connection={connection}
                onLogin={auth.login}
                onLogout={auth.logout}
                onRegister={auth.register}
                user={user ? { username: user.username } : null}
              />

              <div className="card">
                <h2>Snapshot sync</h2>
                <p className="muted">
                  Use this when you want to replace the cloud snapshot with your current local state, or pull the
                  latest cloud snapshot back to this device. Local-only raw files are not bulk-uploaded by this action.
                </p>
                <div className="action-row">
                  <button
                    className="primary-button"
                    disabled={!user || busyAction !== null}
                    onClick={() => void runCloudAction("push")}
                    type="button"
                  >
                    {busyAction === "push" ? "Pushing..." : "Push local data to cloud"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!user || busyAction !== null}
                    onClick={() => void runCloudAction("pull")}
                    type="button"
                  >
                    {busyAction === "pull" ? "Pulling..." : "Pull cloud data to this device"}
                  </button>
                </div>
                {cloudStatus ? <p className="muted">{cloudStatus}</p> : null}
                {cloudError ? <p className="error-text">{cloudError}</p> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
