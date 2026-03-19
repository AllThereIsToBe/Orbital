import type { AppState, Course, Id, WorkflowDefinition } from "./models.ts";

const trim = (value: string, max = 1_200) =>
  value.length <= max ? value : `${value.slice(0, max)}...`;

export const workflowTemplates: WorkflowDefinition[] = [
  {
    id: "workflow-lecture-brief",
    name: "Lecture Briefing Pipeline",
    description:
      "Identify the most relevant lesson context, compress the source material, and produce a tutor-style walkthrough.",
    inputMode: "course-material",
    stepIds: ["step-route", "step-synthesize", "step-tutor"],
    steps: [
      {
        id: "step-route",
        name: "Scope the lesson",
        role: "router",
        providerId: "provider-deepseek",
        systemPrompt:
          "You are a study workflow router. Determine which lesson objectives and material fragments matter most, then produce a focused study brief."
      },
      {
        id: "step-synthesize",
        name: "Build the summary",
        role: "synthesizer",
        providerId: "provider-deepseek",
        systemPrompt:
          "You are a rigorous academic synthesizer. Convert the scoped brief into a structured explanation with formulas, definitions, and likely pitfalls."
      },
      {
        id: "step-tutor",
        name: "Act as tutor",
        role: "tutor",
        providerId: "provider-openai-compatible",
        systemPrompt:
          "You are a patient but demanding tutor. Turn the study brief into an active-learning dialogue with probing questions and worked examples."
      }
    ]
  },
  {
    id: "workflow-exam-prep",
    name: "Exam Prep Pipeline",
    description:
      "Compress the course into exam-relevant concepts, then generate a focused revision pack and self-test prompts.",
    inputMode: "course-material",
    stepIds: ["step-retrieve", "step-quiz", "step-tutor"],
    steps: [
      {
        id: "step-retrieve",
        name: "Extract examinable content",
        role: "retriever",
        providerId: "provider-deepseek",
        systemPrompt:
          "Extract the concepts, formula families, derivations, and common exam traps that matter most from the supplied course context."
      },
      {
        id: "step-quiz",
        name: "Generate retrieval practice",
        role: "quizzer",
        providerId: "provider-deepseek",
        systemPrompt:
          "Create high-value active recall questions, numerical prompts, and flashcards calibrated for engineering exams."
      },
      {
        id: "step-tutor",
        name: "Build coaching notes",
        role: "tutor",
        providerId: "provider-openai-compatible",
        systemPrompt:
          "Turn the exam prep pack into a realistic revision session plan with sequencing, pacing, and weak-point targeting."
      }
    ]
  },
  {
    id: "workflow-plan-week",
    name: "Adaptive Weekly Planning",
    description:
      "Take your current coursework, open tasks, and recent study distribution and turn it into a practical weekly attack plan.",
    inputMode: "manual-brief",
    stepIds: ["step-plan"],
    steps: [
      {
        id: "step-plan",
        name: "Plan the week",
        role: "planner",
        providerId: "provider-deepseek",
        systemPrompt:
          "You are an execution-focused academic planner. Break the input into a realistic week plan with time blocks, priorities, and fallback rules."
      }
    ]
  }
];

const buildCourseSnapshot = (course: Course) => {
  const lessons = course.lessons
    .map((lesson) => `Week ${lesson.week}: ${lesson.title} | ${lesson.objectives.join("; ")}`)
    .join("\n");

  const materials = course.materials
    .map((material) => {
      const preview = material.extractedText ? ` | Preview: ${trim(material.extractedText, 220)}` : "";
      return `${material.kind.toUpperCase()}: ${material.name}${preview}`;
    })
    .join("\n");

  const notes = course.notes
    .map((note) => `${note.title}: ${trim(note.body, 240)}`)
    .join("\n");

  return [
    `Course: ${course.title} (${course.code})`,
    `Discipline: ${course.discipline}`,
    `Overview: ${course.overview}`,
    lessons ? `Lessons:\n${lessons}` : "",
    materials ? `Materials:\n${materials}` : "",
    notes ? `Notes:\n${notes}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const buildWorkflowInput = (
  state: AppState,
  workflowId: Id,
  courseId: Id | undefined,
  userBrief: string
) => {
  const workflow = state.workflows.find((item) => item.id === workflowId);

  if (!workflow) {
    throw new Error("Workflow not found.");
  }

  if (!courseId || workflow.inputMode === "manual-brief") {
    return userBrief.trim();
  }

  const course = state.courses.find((item) => item.id === courseId);

  if (!course) {
    throw new Error("Course not found.");
  }

  const snapshot = buildCourseSnapshot(course);
  return userBrief.trim() ? `${snapshot}\n\nUser brief:\n${userBrief.trim()}` : snapshot;
};
