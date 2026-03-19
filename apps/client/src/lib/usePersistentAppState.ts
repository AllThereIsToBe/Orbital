import type {
  AIProvider,
  AppState,
  CourseMaterialMeta,
  Flashcard,
  FocusSession,
  Note,
  Task,
  TaskStatus,
  WorkflowDefinition
} from "@orbital/domain";
import { useEffect, useReducer } from "react";

import { loadAppState, saveAppState } from "@orbital/storage";

export type AppAction =
  | { type: "replaceState"; state: AppState }
  | { type: "logSession"; session: FocusSession }
  | { type: "setTaskStatus"; taskId: string; status: TaskStatus }
  | { type: "addTask"; task: Task }
  | { type: "addMaterial"; material: CourseMaterialMeta }
  | { type: "addNote"; note: Note }
  | { type: "addFlashcard"; card: Flashcard }
  | { type: "reviewFlashcard"; card: Flashcard }
  | { type: "deleteFlashcard"; cardId: string }
  | { type: "addProvider"; provider: AIProvider }
  | { type: "removeProvider"; providerId: string }
  | { type: "updateProvider"; providerId: string; patch: Partial<AIProvider> }
  | { type: "upsertWorkflow"; workflow: WorkflowDefinition };

const reducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "replaceState":
      return action.state;
    case "logSession":
      return {
        ...state,
        sessions: [action.session, ...state.sessions],
        tasks: state.tasks.map((task) => {
          if (task.id !== action.session.taskId) {
            return task;
          }

          return {
            ...task,
            status: task.status === "todo" ? "in_progress" : task.status,
            focusMinutesLogged: task.focusMinutesLogged + action.session.durationMin
          };
        })
      };
    case "setTaskStatus":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId ? { ...task, status: action.status } : task
        )
      };
    case "addTask":
      return {
        ...state,
        tasks: [action.task, ...state.tasks]
      };
    case "addMaterial":
      return {
        ...state,
        courses: state.courses.map((course) => {
          if (course.id !== action.material.courseId) {
            return course;
          }

          return {
            ...course,
            materials: [action.material, ...course.materials],
            lessons: course.lessons.map((lesson) =>
              action.material.lessonIds.includes(lesson.id)
                ? {
                    ...lesson,
                    linkedMaterialIds: [...lesson.linkedMaterialIds, action.material.id]
                  }
                : lesson
            )
          };
        })
      };
    case "addNote":
      return {
        ...state,
        courses: state.courses.map((course) =>
          course.id === action.note.courseId
            ? { ...course, notes: [action.note, ...course.notes] }
            : course
        )
      };
    case "addFlashcard":
      return {
        ...state,
        flashcards: [action.card, ...state.flashcards.filter((card) => card.id !== action.card.id)]
      };
    case "reviewFlashcard":
      return {
        ...state,
        flashcards: state.flashcards.map((card) =>
          card.id === action.card.id ? action.card : card
        )
      };
    case "deleteFlashcard":
      return {
        ...state,
        flashcards: state.flashcards.filter((card) => card.id !== action.cardId)
      };
    case "addProvider":
      return {
        ...state,
        providers: [action.provider, ...state.providers]
      };
    case "removeProvider":
      return {
        ...state,
        providers: state.providers.filter((provider) => provider.id !== action.providerId),
        workflows: state.workflows.map((workflow) => ({
          ...workflow,
          steps: workflow.steps.map((step) =>
            step.providerId === action.providerId
              ? {
                  ...step,
                  providerId: state.providers.find((provider) => provider.id !== action.providerId)?.id || step.providerId
                }
              : step
          )
        }))
      };
    case "updateProvider":
      return {
        ...state,
        providers: state.providers.map((provider) =>
          provider.id === action.providerId
            ? {
                ...provider,
                ...action.patch,
                capabilities: {
                  ...provider.capabilities,
                  ...action.patch.capabilities
                }
              }
            : provider
        )
      };
    case "upsertWorkflow":
      return {
        ...state,
        workflows: state.workflows.some((workflow) => workflow.id === action.workflow.id)
          ? state.workflows.map((workflow) =>
              workflow.id === action.workflow.id ? action.workflow : workflow
            )
          : [action.workflow, ...state.workflows]
      };
    default:
      return state;
  }
};

export const usePersistentAppState = () => {
  const [state, dispatch] = useReducer(reducer, undefined, loadAppState);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  return { state, dispatch };
};
