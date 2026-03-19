import { getGoalProgress, getSuggestedFocus, getTimeSummary } from "@orbital/domain";
import { lazy, Suspense, useState } from "react";

import { Sidebar, type AppView } from "./features/layout/Sidebar";
import { useAppearancePreferences } from "./lib/useAppearancePreferences";
import { useOrbitalPlatform } from "./lib/useOrbitalPlatform";

const AnalyticsView = lazy(() =>
  import("./features/analytics/AnalyticsView").then((module) => ({ default: module.AnalyticsView }))
);
const LearnCenter = lazy(() =>
  import("./features/learn/LearnCenter").then((module) => ({ default: module.LearnCenter }))
);
const PlanCenter = lazy(() =>
  import("./features/plan/PlanCenter").then((module) => ({ default: module.PlanCenter }))
);
const SettingsDrawer = lazy(() =>
  import("./features/layout/SettingsDrawer").then((module) => ({ default: module.SettingsDrawer }))
);
const SocialHub = lazy(() =>
  import("./features/social/SocialHub").then((module) => ({ default: module.SocialHub }))
);

const App = () => {
  const platform = useOrbitalPlatform();
  const appearance = useAppearancePreferences();
  const { state, dispatch } = platform;
  const [view, setView] = useState<AppView>("learn");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const summary = getTimeSummary(state);
  const recommendation = getSuggestedFocus(state);
  const goalProgress = getGoalProgress(state)
    .sort((left, right) => right.completionRatio - left.completionRatio)
    .slice(0, 3);

  return (
    <div className="shell">
      <Sidebar
        activeView={view}
        onOpenSettings={() => setIsSettingsOpen(true)}
        setActiveView={setView}
        summary={summary}
        recommendation={recommendation}
        goals={goalProgress}
        connection={platform.connection}
        user={platform.auth.user}
      />
      <main className="main-panel">
        {platform.error ? <p className="error-text">{platform.error}</p> : null}
        <Suspense fallback={<p className="muted">Loading view...</p>}>
          {view === "learn" && (
            <LearnCenter
              dispatch={dispatch}
              onOpenSettings={() => setIsSettingsOpen(true)}
              state={state}
              server={platform.server}
            />
          )}
          {view === "plan" && (
            <PlanCenter
              canSync={platform.isCloudMode}
              dispatch={dispatch}
              events={platform.calendarEvents}
              importCalendar={platform.server.importCalendar}
              state={state}
            />
          )}
          {view === "insights" && <AnalyticsView state={state} />}
          {view === "social" && (
            <SocialHub
              canSync={platform.isCloudMode}
              currentUser={platform.auth.user}
              friendships={platform.friendships}
              leaderboard={platform.leaderboard}
              requestFriend={platform.server.requestFriend}
              acceptFriend={platform.server.acceptFriend}
              refreshLeaderboard={platform.server.refreshLeaderboard}
            />
          )}
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <SettingsDrawer
          auth={platform.auth}
          canUseServer={platform.isCloudMode}
          cloudSync={platform.cloudSync}
          connection={platform.connection}
          dispatch={dispatch}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          preferences={appearance.preferences}
          resetPreferences={appearance.resetPreferences}
          runServerWorkflow={platform.server.runWorkflow}
          state={state}
          updatePreferences={appearance.updatePreferences}
          user={platform.auth.user}
        />
      </Suspense>
    </div>
  );
};

export default App;
