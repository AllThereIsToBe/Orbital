import type { AppState, Flashcard, FlashcardRating, Id } from "./models.ts";

const MINUTE = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;

const addMinutes = (value: string, minutes: number) =>
  new Date(new Date(value).getTime() + minutes * MINUTE).toISOString();

export const createFlashcard = (
  input: Pick<Flashcard, "prompt" | "answer"> &
    Partial<
      Pick<
        Flashcard,
        "id" | "courseId" | "lessonId" | "tagIds" | "sourceMaterialId" | "sourceNoteId" | "createdAt"
      >
    >
): Flashcard => {
  const createdAt = input.createdAt || new Date().toISOString();

  return {
    id: input.id || `flashcard-${crypto.randomUUID()}`,
    courseId: input.courseId,
    lessonId: input.lessonId,
    tagIds: input.tagIds || [],
    prompt: input.prompt.trim(),
    answer: input.answer.trim(),
    createdAt,
    updatedAt: createdAt,
    dueAt: createdAt,
    state: "new",
    intervalMinutes: 0,
    ease: 2.3,
    reviewCount: 0,
    lapseCount: 0,
    sourceMaterialId: input.sourceMaterialId,
    sourceNoteId: input.sourceNoteId
  };
};

export const applyFlashcardReview = (
  card: Flashcard,
  rating: FlashcardRating,
  reviewedAt = new Date().toISOString()
): Flashcard => {
  const currentInterval = Math.max(0, Math.round(card.intervalMinutes || 0));
  let ease = Math.max(1.3, card.ease || 2.3);
  let intervalMinutes = currentInterval;
  let lapseCount = card.lapseCount;
  let state = card.state;

  if (rating === "again") {
    intervalMinutes = 10;
    ease = Math.max(1.3, ease - 0.2);
    lapseCount += 1;
    state = "learning";
  }

  if (rating === "hard") {
    intervalMinutes =
      card.state === "new"
        ? 8 * HOUR
        : Math.max(8 * HOUR, Math.round((currentInterval || DAY) * 1.2));
    ease = Math.max(1.4, ease - 0.15);
    state = intervalMinutes < DAY ? "learning" : "review";
  }

  if (rating === "good") {
    intervalMinutes =
      card.state === "new"
        ? DAY
        : Math.max(DAY, Math.round((currentInterval || DAY) * ease));
    ease = Math.min(3.2, ease + 0.05);
    state = "review";
  }

  if (rating === "easy") {
    intervalMinutes =
      card.state === "new"
        ? 3 * DAY
        : Math.max(3 * DAY, Math.round((currentInterval || DAY) * (ease + 0.35)));
    ease = Math.min(3.4, ease + 0.1);
    state = "review";
  }

  return {
    ...card,
    updatedAt: reviewedAt,
    dueAt: addMinutes(reviewedAt, intervalMinutes),
    state,
    intervalMinutes,
    ease,
    reviewCount: card.reviewCount + 1,
    lapseCount,
    lastReviewedAt: reviewedAt,
    lastRating: rating
  };
};

export const getDueFlashcards = (
  state: Pick<AppState, "flashcards">,
  options: {
    courseId?: Id;
    now?: Date;
    includeFuture?: boolean;
  } = {}
) => {
  const nowTime = (options.now || new Date()).getTime();

  return [...state.flashcards]
    .filter((card) => (options.courseId ? card.courseId === options.courseId : true))
    .filter((card) => options.includeFuture || new Date(card.dueAt).getTime() <= nowTime)
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
};

export const getFlashcardStats = (
  state: Pick<AppState, "courses" | "flashcards">,
  now = new Date()
) => {
  const nowTime = now.getTime();
  const due = state.flashcards.filter((card) => new Date(card.dueAt).getTime() <= nowTime).length;
  const learning = state.flashcards.filter((card) => card.state === "learning").length;
  const fresh = state.flashcards.filter((card) => card.state === "new").length;
  const mastered = state.flashcards.filter((card) => card.intervalMinutes >= 30 * DAY).length;

  return {
    total: state.flashcards.length,
    due,
    learning,
    fresh,
    mastered,
    review: state.flashcards.filter((card) => card.state === "review").length,
    byCourse: state.courses.map((course) => {
      const cards = state.flashcards.filter((card) => card.courseId === course.id);
      return {
        courseId: course.id,
        title: course.title,
        total: cards.length,
        due: cards.filter((card) => new Date(card.dueAt).getTime() <= nowTime).length
      };
    })
  };
};
