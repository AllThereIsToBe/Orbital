import type {
  AIProvider,
  AppState,
  Course,
  Flashcard,
  FocusSession,
  Goal,
  Tag,
  Task
} from "./models.ts";
import { createFlashcard } from "./review.ts";
import { workflowTemplates } from "./workflows.ts";

const now = Date.now();
const isoOffset = (daysOffset: number, hour = 12) =>
  new Date(now + daysOffset * 86_400_000).setHours(hour, 0, 0, 0);

const toIso = (timestamp: number) => new Date(timestamp).toISOString();

const tags: Tag[] = [
  { id: "tag-math", label: "math", color: "#dd5f87" },
  { id: "tag-physics", label: "physics", color: "#9f5cf2" },
  { id: "tag-space", label: "space", color: "#ff7b8f" },
  { id: "tag-electronics", label: "electronics", color: "#5e89ff" },
  { id: "tag-deep-work", label: "deep work", color: "#51274f" },
  { id: "tag-exam-prep", label: "exam prep", color: "#ff9f6e" },
  { id: "tag-notes", label: "notes", color: "#7d688e" }
];

const goals: Goal[] = [
  {
    id: "goal-math-hours",
    title: "10,000 hours of mathematics",
    horizon: "lifetime",
    targetMinutes: 600_000,
    includedTagIds: ["tag-math"],
    excludedTagIds: [],
    notes: "Count any mathematically meaningful focus block, even when embedded inside physics courses."
  },
  {
    id: "goal-orbital-exam",
    title: "Orbital dynamics exam mastery",
    horizon: "mid",
    targetMinutes: 4_800,
    includedTagIds: ["tag-space", "tag-physics"],
    excludedTagIds: [],
    notes: "Drive toward deep conceptual fluency and problem-solving speed."
  },
  {
    id: "goal-consistency",
    title: "Maintain consistent weekly deep work",
    horizon: "short",
    targetMinutes: 900,
    includedTagIds: ["tag-deep-work"],
    excludedTagIds: [],
    notes: "Protect the habit, not just the exam."
  }
];

const baseCapabilities = {
  chat: true,
  reasoning: true,
  agentic: true,
  toolUse: true,
  vision: false,
  multimodal: false,
  transcription: false,
  embeddings: false,
  rerank: false,
  speech: false
};

const providers: AIProvider[] = [
  {
    id: "provider-openai",
    name: "OpenAI / ChatGPT",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1",
    mode: "remote",
    enabled: false,
    capabilities: {
      ...baseCapabilities,
      vision: true,
      multimodal: true,
      transcription: true,
      embeddings: true,
      speech: true
    }
  },
  {
    id: "provider-deepseek",
    name: "DeepSeek",
    kind: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat",
    mode: "remote",
    enabled: false,
    capabilities: {
      ...baseCapabilities
    }
  },
  {
    id: "provider-claude",
    name: "Anthropic Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-3-7-sonnet-latest",
    mode: "remote",
    enabled: false,
    apiVersion: "2023-06-01",
    capabilities: {
      ...baseCapabilities,
      vision: true,
      multimodal: true
    }
  },
  {
    id: "provider-grok",
    name: "xAI Grok",
    kind: "xai",
    baseUrl: "https://api.x.ai/v1",
    apiKey: "",
    model: "grok-2-latest",
    mode: "remote",
    enabled: false,
    capabilities: {
      ...baseCapabilities,
      vision: true,
      multimodal: true
    }
  },
  {
    id: "provider-gemini",
    name: "Google Gemini",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    model: "gemini-2.0-flash",
    mode: "remote",
    enabled: false,
    capabilities: {
      ...baseCapabilities,
      vision: true,
      multimodal: true,
      embeddings: true,
      speech: true
    }
  },
  {
    id: "provider-openai-compatible",
    name: "Generic OpenAI-compatible",
    kind: "openai-compatible",
    baseUrl: "",
    apiKey: "",
    model: "",
    mode: "remote",
    enabled: false,
    capabilities: {
      ...baseCapabilities,
      vision: true,
      multimodal: true,
      transcription: true,
      embeddings: true,
      speech: true
    }
  },
  {
    id: "provider-ollama",
    name: "Ollama local",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    apiKey: "",
    model: "llama3.2",
    mode: "local",
    enabled: false,
    capabilities: {
      ...baseCapabilities,
      vision: true,
      multimodal: true,
      embeddings: true
    }
  }
];

const courses: Course[] = [
  {
    id: "course-mechanics",
    title: "Advanced Mechanics",
    code: "MECH-402",
    discipline: "Applied Physics",
    accent: "#ff7b8f",
    overview:
      "A force-and-energy-heavy mechanics course with an emphasis on constrained systems, Lagrangian formalisms, and problem-solving fluency.",
    lessons: [
      {
        id: "lesson-lagrangian",
        title: "Lagrangian Mechanics Foundations",
        week: 1,
        status: "current",
        objectives: [
          "Derive Euler-Lagrange equations from the principle of stationary action.",
          "Interpret generalized coordinates and constraints.",
          "Translate Newtonian systems into a variational formulation."
        ],
        linkedMaterialIds: []
      },
      {
        id: "lesson-central-force",
        title: "Central Force Motion",
        week: 2,
        status: "upcoming",
        objectives: [
          "Derive effective potentials.",
          "Connect orbital motion to conserved quantities.",
          "Interpret stable and unstable trajectories."
        ],
        linkedMaterialIds: []
      }
    ],
    chats: [
      {
        id: "chat-mechanics-review",
        title: "Lecture 1 review",
        purpose: "Clarify derivations and translate the lecture into structured notes.",
        lastActivityAt: toIso(isoOffset(-1))
      },
      {
        id: "chat-mechanics-exam",
        title: "Exam prep",
        purpose: "Practice conceptual and numerical exam questions.",
        lastActivityAt: toIso(isoOffset(-3))
      }
    ],
    materials: [
      {
        id: "material-lagrangian-notes",
        courseId: "course-mechanics",
        lessonIds: ["lesson-lagrangian"],
        name: "Week 1 derivation notes",
        kind: "notes",
        sizeBytes: 3_200,
        createdAt: toIso(isoOffset(-4)),
        tags: ["tag-physics", "tag-notes"],
        extractedText:
          "The Lagrangian formulation replaces vector force balancing with a scalar function L = T - V. For a constrained system, choose generalized coordinates q_i and apply d/dt (partial L / partial q_dot_i) - partial L / partial q_i = 0."
      }
    ],
    notes: [
      {
        id: "note-mechanics-1",
        courseId: "course-mechanics",
        createdAt: toIso(isoOffset(-2)),
        title: "Mechanics pain points",
        body:
          "I understand the algebra of Euler-Lagrange better than the physical intuition. Need more practice with choosing generalized coordinates quickly.",
        linkedLessonIds: ["lesson-lagrangian"]
      }
    ]
  },
  {
    id: "course-orbital",
    title: "Orbital Dynamics",
    code: "SPACE-315",
    discipline: "Astronautics",
    accent: "#d45ce8",
    overview:
      "Astrodynamics with two-body motion, orbital maneuvers, perturbations, and mission design framing.",
    lessons: [
      {
        id: "lesson-kepler",
        title: "Keplerian Elements",
        week: 1,
        status: "reviewed",
        objectives: [
          "Interpret the six classical orbital elements.",
          "Move between geometric and state-vector descriptions."
        ],
        linkedMaterialIds: []
      },
      {
        id: "lesson-maneuvers",
        title: "Hohmann and Plane Change Maneuvers",
        week: 2,
        status: "current",
        objectives: [
          "Compute delta-v budgets.",
          "Compare transfer strategies under engineering constraints."
        ],
        linkedMaterialIds: []
      }
    ],
    chats: [
      {
        id: "chat-orbital-pset",
        title: "Problem set 3",
        purpose: "Work through transfer orbit calculations without skipping intermediate reasoning.",
        lastActivityAt: toIso(isoOffset(-1))
      },
      {
        id: "chat-orbital-flashcards",
        title: "Flashcard generation",
        purpose: "Extract formula and concept cards from the current lesson.",
        lastActivityAt: toIso(isoOffset(-6))
      }
    ],
    materials: [
      {
        id: "material-kepler-summary",
        courseId: "course-orbital",
        lessonIds: ["lesson-kepler", "lesson-maneuvers"],
        name: "Kepler and transfer summary",
        kind: "text",
        sizeBytes: 4_100,
        createdAt: toIso(isoOffset(-5)),
        tags: ["tag-space", "tag-physics"],
        extractedText:
          "A transfer orbit is judged by total delta-v, time of flight, and operational feasibility. Hohmann transfers are optimal for coplanar circular orbits when only two impulses are used."
      }
    ],
    notes: [
      {
        id: "note-orbital-1",
        courseId: "course-orbital",
        createdAt: toIso(isoOffset(-1)),
        title: "Transfer maneuver heuristics",
        body:
          "I should memorize when a Hohmann transfer ceases to be a good approximation and when bi-elliptic transfers become competitive.",
        linkedLessonIds: ["lesson-maneuvers"]
      }
    ]
  },
  {
    id: "course-signals",
    title: "Signals and Electronics",
    code: "EE-220",
    discipline: "Electrical Engineering",
    accent: "#6f8aff",
    overview:
      "Signal analysis, circuit intuition, and frequency-domain thinking for real engineering systems.",
    lessons: [
      {
        id: "lesson-fourier",
        title: "Fourier Series and Spectra",
        week: 1,
        status: "current",
        objectives: [
          "Interpret frequency content from periodic time-domain signals.",
          "Connect coefficient symmetry with signal properties."
        ],
        linkedMaterialIds: []
      }
    ],
    chats: [
      {
        id: "chat-signals-general",
        title: "General questions",
        purpose: "Collect confusing points from the lectures and clean them up later.",
        lastActivityAt: toIso(isoOffset(-4))
      }
    ],
    materials: [],
    notes: []
  }
];

const tasks: Task[] = [
  {
    id: "task-orbital-pset",
    title: "Finish orbital dynamics problem set 3",
    status: "in_progress",
    dueAt: toIso(isoOffset(2)),
    courseId: "course-orbital",
    estimateMin: 180,
    energy: "high",
    priority: 9,
    tags: ["tag-space", "tag-physics", "tag-deep-work"],
    focusMinutesLogged: 55
  },
  {
    id: "task-mechanics-summary",
    title: "Create a compact Lagrangian revision sheet",
    status: "todo",
    dueAt: toIso(isoOffset(1)),
    courseId: "course-mechanics",
    estimateMin: 90,
    energy: "medium",
    priority: 8,
    tags: ["tag-physics", "tag-exam-prep", "tag-notes"],
    focusMinutesLogged: 0
  },
  {
    id: "task-signals-review",
    title: "Review Fourier symmetry identities",
    status: "todo",
    dueAt: toIso(isoOffset(4)),
    courseId: "course-signals",
    estimateMin: 60,
    energy: "medium",
    priority: 6,
    tags: ["tag-electronics", "tag-math"],
    focusMinutesLogged: 0
  },
  {
    id: "task-workout",
    title: "Strength training session",
    status: "todo",
    estimateMin: 60,
    energy: "high",
    priority: 5,
    tags: ["tag-deep-work"],
    focusMinutesLogged: 0
  }
];

const sessions: FocusSession[] = [
  {
    id: "session-1",
    startAt: toIso(isoOffset(-1, 8)),
    endAt: toIso(isoOffset(-1, 8) + 50 * 60_000),
    durationMin: 50,
    mode: "deep",
    courseId: "course-orbital",
    taskId: "task-orbital-pset",
    tagIds: ["tag-space", "tag-physics", "tag-deep-work"],
    note: "Worked through delta-v bookkeeping."
  },
  {
    id: "session-2",
    startAt: toIso(isoOffset(-2, 10)),
    endAt: toIso(isoOffset(-2, 10) + 25 * 60_000),
    durationMin: 25,
    mode: "pomodoro",
    courseId: "course-mechanics",
    tagIds: ["tag-physics", "tag-math"],
    note: "Reviewed constrained coordinates."
  },
  {
    id: "session-3",
    startAt: toIso(isoOffset(-6, 13)),
    endAt: toIso(isoOffset(-6, 13) + 90 * 60_000),
    durationMin: 90,
    mode: "deep",
    courseId: "course-signals",
    tagIds: ["tag-electronics", "tag-math", "tag-deep-work"]
  }
];

const flashcards: Flashcard[] = [
  createFlashcard({
    id: "flashcard-lagrangian-equation",
    courseId: "course-mechanics",
    lessonId: "lesson-lagrangian",
    tagIds: ["tag-physics", "tag-exam-prep"],
    createdAt: toIso(isoOffset(-3)),
    prompt: "What is the Euler-Lagrange equation for a generalized coordinate q_i?",
    answer: "d/dt (partial L / partial q_dot_i) - partial L / partial q_i = 0."
  }),
  {
    ...createFlashcard({
      id: "flashcard-hohmann-definition",
      courseId: "course-orbital",
      lessonId: "lesson-maneuvers",
      tagIds: ["tag-space", "tag-physics"],
      createdAt: toIso(isoOffset(-4)),
      prompt: "When is a Hohmann transfer optimal?",
      answer:
        "For coplanar circular orbits when only two impulsive burns are allowed and time of flight is not separately optimized."
    }),
    state: "review",
    intervalMinutes: 3 * 24 * 60,
    ease: 2.6,
    reviewCount: 4,
    dueAt: toIso(isoOffset(-1)),
    updatedAt: toIso(isoOffset(-2)),
    lastReviewedAt: toIso(isoOffset(-2)),
    lastRating: "good"
  },
  {
    ...createFlashcard({
      id: "flashcard-fourier-symmetry",
      courseId: "course-signals",
      lessonId: "lesson-fourier",
      tagIds: ["tag-electronics", "tag-math"],
      createdAt: toIso(isoOffset(-2)),
      prompt: "What symmetry in the time-domain signal produces a purely sine-series Fourier expansion?",
      answer: "Odd symmetry, because all cosine coefficients and the DC term vanish."
    }),
    state: "learning",
    intervalMinutes: 8 * 60,
    ease: 2.1,
    reviewCount: 1,
    dueAt: toIso(isoOffset(0, 9)),
    updatedAt: toIso(isoOffset(-1)),
    lastReviewedAt: toIso(isoOffset(-1)),
    lastRating: "hard"
  }
];

export const createSeedState = (): AppState => ({
  courses,
  tasks,
  tags,
  goals,
  sessions,
  flashcards,
  providers,
  workflows: workflowTemplates
});
