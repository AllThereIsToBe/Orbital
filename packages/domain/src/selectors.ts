import type {
  AppState,
  FocusSession,
  GoalProgress,
  Id,
  ScheduleSuggestion,
  Task,
  TimeSummary
} from "./models.ts";

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date: Date) => {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);

const sumSessions = (sessions: FocusSession[], predicate: (session: FocusSession) => boolean) =>
  sessions.reduce((total, session) => total + (predicate(session) ? session.durationMin : 0), 0);

export const getTimeSummary = (state: AppState, now = new Date()): TimeSummary => {
  const dayStart = startOfDay(now).getTime();
  const weekStart = startOfWeek(now).getTime();
  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();

  const sessionTime = (session: FocusSession) => new Date(session.startAt).getTime();

  return {
    today: sumSessions(state.sessions, (session) => sessionTime(session) >= dayStart),
    week: sumSessions(state.sessions, (session) => sessionTime(session) >= weekStart),
    month: sumSessions(state.sessions, (session) => sessionTime(session) >= monthStart),
    year: sumSessions(state.sessions, (session) => sessionTime(session) >= yearStart),
    lifetime: sumSessions(state.sessions, () => true)
  };
};

export const getMinutesByCourse = (state: AppState) =>
  state.courses.map((course) => ({
    courseId: course.id,
    title: course.title,
    minutes: state.sessions
      .filter((session) => session.courseId === course.id)
      .reduce((total, session) => total + session.durationMin, 0)
  }));

export const getMinutesByTag = (state: AppState) =>
  state.tags.map((tag) => ({
    tagId: tag.id,
    label: tag.label,
    minutes: state.sessions
      .filter((session) => session.tagIds.includes(tag.id))
      .reduce((total, session) => total + session.durationMin, 0)
  }));

export const getGoalProgress = (state: AppState): GoalProgress[] =>
  state.goals.map((goal) => {
    const completedMinutes = state.sessions.reduce((total, session) => {
      const hasIncludedTag = goal.includedTagIds.length === 0 || session.tagIds.some((tagId) => goal.includedTagIds.includes(tagId));
      const hasExcludedTag = session.tagIds.some((tagId) => goal.excludedTagIds.includes(tagId));
      return total + (hasIncludedTag && !hasExcludedTag ? session.durationMin : 0);
    }, 0);

    return {
      goal,
      completedMinutes,
      completionRatio: goal.targetMinutes === 0 ? 0 : completedMinutes / goal.targetMinutes
    };
  });

export const getUpcomingTasks = (state: AppState) =>
  [...state.tasks]
    .filter((task) => task.status !== "done")
    .sort((left, right) => {
      const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return right.priority - left.priority;
    });

const scoreTask = (task: Task) => {
  const duePenalty = task.dueAt ? Math.max(1, 14 - Math.floor((new Date(task.dueAt).getTime() - Date.now()) / 86_400_000)) : 2;
  return duePenalty * 10 + task.priority * 7 + (task.status === "in_progress" ? 12 : 0) + Math.max(0, 120 - task.focusMinutesLogged) / 10;
};

export const buildScheduleSuggestions = (state: AppState): ScheduleSuggestion[] => {
  const tasks = [...state.tasks]
    .filter((task) => task.status !== "done")
    .sort((left, right) => scoreTask(right) - scoreTask(left))
    .slice(0, 4);

  return tasks.map((task, index) => ({
    id: `suggestion-${task.id}`,
    title: index === 0 ? `Start with ${task.title}` : `Then tackle ${task.title}`,
    reason: task.dueAt
      ? `Due ${new Date(task.dueAt).toLocaleDateString()} and currently ${task.status.replace("_", " ")}.`
      : `High strategic value because it reinforces ongoing course work.`,
    suggestedMinutes: Math.max(25, Math.min(90, task.estimateMin - task.focusMinutesLogged || task.estimateMin)),
    taskId: task.id,
    courseId: task.courseId,
    tagIds: task.tags
  }));
};

export const getSuggestedFocus = (state: AppState) => {
  const [topTask] = buildScheduleSuggestions(state);

  if (topTask) {
    return topTask;
  }

  const lowestCoverageCourse = getMinutesByCourse(state)
    .filter((entry) => entry.minutes >= 0)
    .sort((left, right) => left.minutes - right.minutes)[0];

  if (lowestCoverageCourse) {
    return {
      id: `suggestion-course-${lowestCoverageCourse.courseId}`,
      title: `Rebalance ${lowestCoverageCourse.title}`,
      reason: "This course has received the least focus time so far.",
      suggestedMinutes: 50,
      courseId: lowestCoverageCourse.courseId,
      tagIds: []
    };
  }

  return {
    id: "suggestion-default",
    title: "Start a 25 minute warm-up block",
    reason: "Momentum beats waiting for the perfect plan.",
    suggestedMinutes: 25,
    tagIds: []
  };
};

export const getCourseById = (state: AppState, courseId?: Id) =>
  state.courses.find((course) => course.id === courseId);
