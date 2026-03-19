const now = Date.now();
const toSeedId = (prefix, value) =>
  `${prefix}-${Buffer.from(String(value || "user").trim().toLowerCase() || "user", "utf8").toString("hex")}`;
const isoOffset = (daysOffset, hour = 12) => {
  const date = new Date(now + daysOffset * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const createDefaultState = (username) => ({
  tags: [
    { id: "tag-math", label: "math", color: "#dd5f87" },
    { id: "tag-physics", label: "physics", color: "#9f5cf2" },
    { id: "tag-space", label: "space", color: "#ff7b8f" },
    { id: "tag-electronics", label: "electronics", color: "#5e89ff" },
    { id: "tag-deep-work", label: "deep work", color: "#51274f" },
    { id: "tag-exam-prep", label: "exam prep", color: "#ff9f6e" },
    { id: "tag-notes", label: "notes", color: "#7d688e" }
  ],
  goals: [
    {
      id: "goal-math-hours",
      title: "10,000 hours of mathematics",
      horizon: "lifetime",
      targetMinutes: 600000,
      includedTagIds: ["tag-math"],
      excludedTagIds: [],
      notes: "Count mathematically meaningful work across courses."
    },
    {
      id: "goal-orbital-exam",
      title: "Orbital dynamics exam mastery",
      horizon: "mid",
      targetMinutes: 4800,
      includedTagIds: ["tag-space", "tag-physics"],
      excludedTagIds: [],
      notes: "Drive toward deep conceptual fluency and speed."
    }
  ],
  courses: [
    {
      id: "course-mechanics",
      title: "Advanced Mechanics",
      code: "MECH-402",
      discipline: "Applied Physics",
      accent: "#ff7b8f",
      overview:
        "A mechanics course centered on constrained systems, Lagrangian formalisms, and problem-solving fluency.",
      lessons: [
        {
          id: "lesson-lagrangian",
          title: "Lagrangian Mechanics Foundations",
          week: 1,
          status: "current",
          objectives: [
            "Derive Euler-Lagrange equations from stationary action.",
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
          lastActivityAt: isoOffset(-1)
        }
      ],
      materials: [],
      notes: [
        {
          id: "note-mechanics-1",
          courseId: "course-mechanics",
          createdAt: isoOffset(-2),
          title: "Mechanics pain points",
          body: "Need more practice choosing generalized coordinates quickly.",
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
        "Astrodynamics with two-body motion, transfer maneuvers, perturbations, and mission design framing.",
      lessons: [
        {
          id: "lesson-kepler",
          title: "Keplerian Elements",
          week: 1,
          status: "reviewed",
          objectives: [
            "Interpret the classical orbital elements.",
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
          purpose: "Work through transfer calculations without skipping reasoning.",
          lastActivityAt: isoOffset(-1)
        }
      ],
      materials: [],
      notes: [
        {
          id: "note-orbital-1",
          courseId: "course-orbital",
          createdAt: isoOffset(-1),
          title: "Transfer maneuver heuristics",
          body: "Memorize when bi-elliptic transfers become competitive.",
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
        "Signal analysis, circuit intuition, and frequency-domain reasoning for real engineering systems.",
      lessons: [
        {
          id: "lesson-fourier",
          title: "Fourier Series and Spectra",
          week: 1,
          status: "current",
          objectives: [
            "Interpret frequency content from periodic signals.",
            "Connect coefficient symmetry with signal properties."
          ],
          linkedMaterialIds: []
        }
      ],
      chats: [],
      materials: [],
      notes: []
    }
  ],
  tasks: [
    {
      id: "task-orbital-pset",
      title: "Finish orbital dynamics problem set 3",
      status: "in_progress",
      dueAt: isoOffset(2),
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
      dueAt: isoOffset(1),
      courseId: "course-mechanics",
      estimateMin: 90,
      energy: "medium",
      priority: 8,
      tags: ["tag-physics", "tag-exam-prep", "tag-notes"],
      focusMinutesLogged: 0
    }
  ],
  sessions: [
    {
      id: toSeedId("session-welcome", username),
      startAt: isoOffset(-1, 8),
      endAt: isoOffset(-1, 8),
      durationMin: 50,
      mode: "deep",
      courseId: "course-orbital",
      taskId: "task-orbital-pset",
      tagIds: ["tag-space", "tag-physics", "tag-deep-work"],
      note: `Initial seeded session for ${username}.`
    }
  ],
  flashcards: [
    {
      id: "flashcard-lagrangian-equation",
      courseId: "course-mechanics",
      lessonId: "lesson-lagrangian",
      tagIds: ["tag-physics", "tag-exam-prep"],
      prompt: "What is the Euler-Lagrange equation for a generalized coordinate q_i?",
      answer: "d/dt (partial L / partial q_dot_i) - partial L / partial q_i = 0.",
      createdAt: isoOffset(-3),
      updatedAt: isoOffset(-3),
      dueAt: isoOffset(-3),
      state: "new",
      intervalMinutes: 0,
      ease: 2.3,
      reviewCount: 0,
      lapseCount: 0
    },
    {
      id: "flashcard-hohmann-definition",
      courseId: "course-orbital",
      lessonId: "lesson-maneuvers",
      tagIds: ["tag-space", "tag-physics"],
      prompt: "When is a Hohmann transfer optimal?",
      answer:
        "For coplanar circular orbits when only two impulsive burns are allowed and time of flight is not separately optimized.",
      createdAt: isoOffset(-4),
      updatedAt: isoOffset(-2),
      dueAt: isoOffset(-1),
      state: "review",
      intervalMinutes: 4320,
      ease: 2.6,
      reviewCount: 4,
      lapseCount: 0,
      lastReviewedAt: isoOffset(-2),
      lastRating: "good"
    },
    {
      id: "flashcard-fourier-symmetry",
      courseId: "course-signals",
      lessonId: "lesson-fourier",
      tagIds: ["tag-electronics", "tag-math"],
      prompt: "What symmetry in the time-domain signal produces a purely sine-series Fourier expansion?",
      answer: "Odd symmetry, because all cosine coefficients and the DC term vanish.",
      createdAt: isoOffset(-2),
      updatedAt: isoOffset(-1),
      dueAt: isoOffset(0, 9),
      state: "learning",
      intervalMinutes: 480,
      ease: 2.1,
      reviewCount: 1,
      lapseCount: 0,
      lastReviewedAt: isoOffset(-1),
      lastRating: "hard"
    }
  ],
  providers: [
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
        chat: true,
        reasoning: true,
        agentic: true,
        toolUse: true,
        vision: true,
        multimodal: true,
        transcription: true,
        embeddings: true,
        rerank: false,
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
        chat: true,
        reasoning: true,
        agentic: true,
        toolUse: true,
        vision: true,
        multimodal: true,
        transcription: false,
        embeddings: false,
        rerank: false,
        speech: false
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
        chat: true,
        reasoning: true,
        agentic: true,
        toolUse: true,
        vision: true,
        multimodal: true,
        transcription: false,
        embeddings: false,
        rerank: false,
        speech: false
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
        chat: true,
        reasoning: true,
        agentic: true,
        toolUse: true,
        vision: true,
        multimodal: true,
        transcription: false,
        embeddings: true,
        rerank: false,
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
        chat: true,
        reasoning: true,
        agentic: true,
        toolUse: true,
        vision: true,
        multimodal: true,
        transcription: true,
        embeddings: true,
        rerank: false,
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
        chat: true,
        reasoning: true,
        agentic: true,
        toolUse: true,
        vision: true,
        multimodal: true,
        transcription: false,
        embeddings: true,
        rerank: false,
        speech: false
      }
    }
  ],
  workflows: [
    {
      id: "workflow-lecture-brief",
      name: "Lecture Briefing Pipeline",
      description:
        "Identify the relevant lesson context, compress the source material, and produce a tutor-style walkthrough.",
      inputMode: "course-material",
      stepIds: ["step-route", "step-synthesize", "step-tutor"],
      steps: [
        {
          id: "step-route",
          name: "Scope the lesson",
          role: "router",
          providerId: "provider-openai-compatible",
          systemPrompt:
            "Determine which lesson objectives and material fragments matter most, then produce a focused study brief."
        },
        {
          id: "step-synthesize",
          name: "Build the summary",
          role: "synthesizer",
          providerId: "provider-openai-compatible",
          systemPrompt:
            "Convert the scoped brief into a structured explanation with formulas, definitions, and likely pitfalls."
        },
        {
          id: "step-tutor",
          name: "Act as tutor",
          role: "tutor",
          providerId: "provider-openai-compatible",
          systemPrompt:
            "Turn the study brief into an active-learning dialogue with probing questions and worked examples."
        }
      ]
    },
    {
      id: "workflow-exam-prep",
      name: "Exam Prep Pipeline",
      description:
        "Compress the course into exam-relevant concepts, then generate a revision pack and self-test prompts.",
      inputMode: "course-material",
      stepIds: ["step-retrieve", "step-quiz", "step-tutor"],
      steps: [
        {
          id: "step-retrieve",
          name: "Extract examinable content",
          role: "retriever",
          providerId: "provider-openai-compatible",
          systemPrompt:
            "Extract the concepts, formula families, derivations, and common exam traps that matter most."
        },
        {
          id: "step-quiz",
          name: "Generate retrieval practice",
          role: "quizzer",
          providerId: "provider-openai-compatible",
          systemPrompt:
            "Create high-value active recall questions and flashcards calibrated for engineering exams."
        },
        {
          id: "step-tutor",
          name: "Build coaching notes",
          role: "tutor",
          providerId: "provider-openai-compatible",
          systemPrompt:
            "Turn the exam prep pack into a realistic revision session plan with sequencing and weak-point targeting."
        }
      ]
    }
  ]
});

const inferProviderKind = (provider) => {
  const lower = `${provider.name || ""} ${provider.baseUrl || ""}`.toLowerCase();

  if (lower.includes("anthropic") || lower.includes("claude")) {
    return "anthropic";
  }

  if (lower.includes("deepseek")) {
    return "deepseek";
  }

  if (lower.includes("x.ai") || lower.includes("grok")) {
    return "xai";
  }

  if (lower.includes("gemini") || lower.includes("googleapis")) {
    return "gemini";
  }

  if (lower.includes("ollama")) {
    return "ollama";
  }

  if (lower.includes("openai")) {
    return "openai";
  }

  return "openai-compatible";
};

const defaultCapabilityShape = createDefaultState("user").providers[0].capabilities;

const normalizeProvider = (provider, fallback) => ({
  ...fallback,
  ...provider,
  kind: provider.kind || inferProviderKind(provider),
  apiVersion: provider.apiVersion || fallback.apiVersion,
  extraHeaders: Array.isArray(provider.extraHeaders) ? provider.extraHeaders : fallback.extraHeaders || [],
  capabilities: {
    ...defaultCapabilityShape,
    ...fallback.capabilities,
    ...(provider.capabilities || {})
  }
});

const migrateBuiltInWorkflow = (workflow) => {
  if (workflow.id !== "workflow-lecture-brief" && workflow.id !== "workflow-exam-prep") {
    return workflow;
  }

  return {
    ...workflow,
    steps: workflow.steps.map((step) =>
      step.providerId === "provider-ollama" ? { ...step, providerId: "provider-openai-compatible" } : step
    )
  };
};

export const normalizeStateSnapshot = (state) => {
  const fallback = createDefaultState("user");
  const providerMap = new Map(fallback.providers.map((provider) => [provider.id, provider]));
  const workflowMap = new Map(fallback.workflows.map((workflow) => [workflow.id, workflow]));
  const normalizedFlashcards = (state.flashcards || []).map((card) => {
    const createdAt = card.createdAt || new Date().toISOString();
    const updatedAt = card.updatedAt || card.createdAt || createdAt;
    const dueAt = card.dueAt || card.createdAt || createdAt;
    return Object.assign(
      {
        tagIds: [],
        prompt: "",
        answer: "",
        createdAt,
        updatedAt,
        dueAt,
        state: "new",
        intervalMinutes: 0,
        ease: 2.3,
        reviewCount: 0,
        lapseCount: 0
      },
      card,
      {
        createdAt,
        updatedAt,
        dueAt
      }
    );
  });

  const normalizedProviders = [
    ...(state.providers || []).map((provider) =>
      normalizeProvider(provider, providerMap.get(provider.id) || fallback.providers[0])
    ),
    ...fallback.providers
      .filter((provider) => !(state.providers || []).some((existing) => existing.id === provider.id))
      .map((provider) => normalizeProvider(provider, provider))
  ];

  const normalizedWorkflows = [
    ...(state.workflows || []).map((workflow) =>
      migrateBuiltInWorkflow({
        ...(workflowMap.get(workflow.id) || workflow),
        ...workflow,
        steps: workflow.steps || workflowMap.get(workflow.id)?.steps || []
      })
    ),
    ...fallback.workflows.filter(
      (workflow) => !(state.workflows || []).some((existing) => existing.id === workflow.id)
    )
  ];

  return {
    ...fallback,
    ...state,
    flashcards: normalizedFlashcards.length > 0 ? normalizedFlashcards : fallback.flashcards,
    providers: normalizedProviders,
    workflows: normalizedWorkflows
  };
};
