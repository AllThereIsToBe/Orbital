export type Id = string;

export type FocusMode = "pomodoro" | "deep" | "sprint";
export type FlashcardState = "new" | "learning" | "review";
export type FlashcardRating = "again" | "hard" | "good" | "easy";
export type MaterialKind =
  | "textbook"
  | "slides"
  | "syllabus"
  | "exam"
  | "assignment"
  | "notes"
  | "audio"
  | "image"
  | "text"
  | "other";

export type TaskStatus = "todo" | "in_progress" | "done";
export type GoalHorizon = "short" | "mid" | "long" | "lifetime";
export type LessonStatus = "upcoming" | "current" | "reviewed";
export type AIProviderMode = "remote" | "local";
export type AIProviderKind =
  | "openai"
  | "openai-compatible"
  | "deepseek"
  | "anthropic"
  | "xai"
  | "gemini"
  | "ollama";
export type AIProviderCapability =
  | "chat"
  | "reasoning"
  | "agentic"
  | "toolUse"
  | "vision"
  | "multimodal"
  | "transcription"
  | "embeddings"
  | "rerank"
  | "speech";
export type WorkflowInputMode = "course-material" | "selected-materials" | "manual-brief";
export type WorkflowRole =
  | "router"
  | "retriever"
  | "vision"
  | "synthesizer"
  | "quizzer"
  | "tutor"
  | "planner";

export interface Tag {
  id: Id;
  label: string;
  color: string;
  parentId?: Id;
}

export interface Goal {
  id: Id;
  title: string;
  horizon: GoalHorizon;
  targetMinutes: number;
  includedTagIds: Id[];
  excludedTagIds: Id[];
  notes?: string;
}

export interface FocusSession {
  id: Id;
  startAt: string;
  endAt: string;
  durationMin: number;
  mode: FocusMode;
  courseId?: Id;
  taskId?: Id;
  tagIds: Id[];
  note?: string;
}

export interface Task {
  id: Id;
  title: string;
  status: TaskStatus;
  dueAt?: string;
  courseId?: Id;
  estimateMin: number;
  energy: "low" | "medium" | "high";
  priority: number;
  tags: Id[];
  focusMinutesLogged: number;
}

export interface Lesson {
  id: Id;
  title: string;
  week: number;
  status: LessonStatus;
  objectives: string[];
  linkedMaterialIds: Id[];
}

export interface ChatThread {
  id: Id;
  title: string;
  purpose: string;
  lastActivityAt: string;
}

export interface CourseMaterialMeta {
  id: Id;
  courseId: Id;
  lessonIds: Id[];
  name: string;
  kind: MaterialKind;
  sizeBytes: number;
  createdAt: string;
  tags: Id[];
  extractedText?: string;
}

export interface Note {
  id: Id;
  courseId: Id;
  createdAt: string;
  title: string;
  body: string;
  linkedLessonIds: Id[];
}

export interface Flashcard {
  id: Id;
  courseId?: Id;
  lessonId?: Id;
  tagIds: Id[];
  prompt: string;
  answer: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  state: FlashcardState;
  intervalMinutes: number;
  ease: number;
  reviewCount: number;
  lapseCount: number;
  lastReviewedAt?: string;
  lastRating?: FlashcardRating;
  sourceMaterialId?: Id;
  sourceNoteId?: Id;
}

export interface Course {
  id: Id;
  title: string;
  code: string;
  discipline: string;
  accent: string;
  overview: string;
  lessons: Lesson[];
  chats: ChatThread[];
  materials: CourseMaterialMeta[];
  notes: Note[];
}

export interface AIProvider {
  id: Id;
  name: string;
  kind: AIProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  mode: AIProviderMode;
  enabled: boolean;
  apiVersion?: string;
  extraHeaders?: Array<{
    key: string;
    value: string;
  }>;
  capabilities: Record<AIProviderCapability, boolean>;
}

export interface WorkflowStep {
  id: Id;
  name: string;
  role: WorkflowRole;
  providerId: Id;
  systemPrompt: string;
}

export interface WorkflowDefinition {
  id: Id;
  name: string;
  description: string;
  inputMode: WorkflowInputMode;
  stepIds: Id[];
  steps: WorkflowStep[];
}

export interface ScheduleSuggestion {
  id: Id;
  title: string;
  reason: string;
  suggestedMinutes: number;
  taskId?: Id;
  courseId?: Id;
  tagIds: Id[];
}

export interface GoalProgress {
  goal: Goal;
  completedMinutes: number;
  completionRatio: number;
}

export interface TimeSummary {
  today: number;
  week: number;
  month: number;
  year: number;
  lifetime: number;
}

export interface WorkflowRunStepResult {
  stepId: Id;
  providerId: Id;
  name: string;
  output: string;
}

export interface WorkflowRunResult {
  workflowId: Id;
  input: string;
  finalOutput: string;
  steps: WorkflowRunStepResult[];
  completedAt: string;
}

export interface CalendarEvent {
  id: Id;
  title: string;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  description?: string | null;
  courseHint?: string | null;
  tags: Id[];
}

export interface UserSummary {
  id: Id;
  username: string;
  createdAt?: string;
}

export interface Friendship {
  id: Id;
  status: "pending" | "accepted";
  createdAt: string;
  requester: UserSummary;
  target: UserSummary;
}

export interface LeaderboardEntry {
  userId: Id;
  username?: string;
  minutes: number;
}

export interface CourseChatMessage {
  id: Id;
  role: "user" | "assistant";
  content: string;
  citations: Array<{
    materialId: Id;
    materialName: string;
    excerpt: string;
  }>;
  createdAt: string;
}

export interface PlatformSnapshot {
  appState: AppState;
  calendarEvents: CalendarEvent[];
  friendships: Friendship[];
  leaderboard: LeaderboardEntry[];
  user: UserSummary | null;
}

export interface AppState {
  courses: Course[];
  tasks: Task[];
  tags: Tag[];
  goals: Goal[];
  sessions: FocusSession[];
  flashcards: Flashcard[];
  providers: AIProvider[];
  workflows: WorkflowDefinition[];
}
