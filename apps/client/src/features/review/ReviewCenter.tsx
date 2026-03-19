import {
  applyFlashcardReview,
  createFlashcard,
  getDueFlashcards,
  getFlashcardStats,
  type AppState,
  type Flashcard,
  type FlashcardRating
} from "@orbital/domain";
import { useEffect, useMemo, useState, type Dispatch } from "react";

import { RichContent } from "../../components/RichContent";
import { SectionHeader } from "../../components/SectionHeader";
import { formatDateTime } from "../../lib/time";
import type { AppAction } from "../../lib/usePersistentAppState";

interface ReviewCenterProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  embedded?: boolean;
}

const ratingOptions: Array<{
  rating: FlashcardRating;
  label: string;
  detail: string;
}> = [
  { rating: "again", label: "Again", detail: "10m" },
  { rating: "hard", label: "Hard", detail: "8h+" },
  { rating: "good", label: "Good", detail: "1d+" },
  { rating: "easy", label: "Easy", detail: "3d+" }
];

const describeInterval = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}m interval`;
  }

  if (minutes < 24 * 60) {
    return `${Math.round(minutes / 60)}h interval`;
  }

  return `${Math.round(minutes / (24 * 60))}d interval`;
};

const summarizeCard = (card: Flashcard) =>
  card.prompt.length > 88 ? `${card.prompt.slice(0, 85)}...` : card.prompt;

export const ReviewCenter = ({ state, dispatch, embedded = false }: ReviewCenterProps) => {
  const [courseFilter, setCourseFilter] = useState("all");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [newCourseId, setNewCourseId] = useState(state.courses[0]?.id || "");
  const [newLessonId, setNewLessonId] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");

  const stats = getFlashcardStats(state);
  const filteredDueCards = useMemo(
    () =>
      getDueFlashcards(state, {
        courseId: courseFilter === "all" ? undefined : courseFilter
      }),
    [courseFilter, state]
  );
  const filteredAllCards = useMemo(
    () =>
      getDueFlashcards(state, {
        courseId: courseFilter === "all" ? undefined : courseFilter,
        includeFuture: true
      }),
    [courseFilter, state]
  );
  const visibleCards = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();

    if (!query) {
      return filteredAllCards;
    }

    return filteredAllCards.filter((card) =>
      [
        card.prompt,
        card.answer,
        state.courses.find((course) => course.id === card.courseId)?.title || ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [filteredAllCards, libraryQuery, state.courses]);

  const activeQueue = filteredDueCards.length > 0 ? filteredDueCards : filteredAllCards;
  const currentCard =
    activeQueue.find((card) => card.id === activeCardId) || activeQueue[0] || null;
  const activeCourse =
    state.courses.find((course) => course.id === (courseFilter === "all" ? undefined : courseFilter)) ||
    null;
  const lessonOptions = state.courses.find((course) => course.id === newCourseId)?.lessons || [];

  useEffect(() => {
    if (!currentCard) {
      setActiveCardId(null);
      return;
    }

    if (activeCardId !== currentCard.id) {
      setActiveCardId(currentCard.id);
    }
  }, [activeCardId, currentCard]);

  useEffect(() => {
    setShowAnswer(false);
  }, [currentCard?.id]);

  useEffect(() => {
    if (!state.courses.some((course) => course.id === newCourseId)) {
      setNewCourseId(state.courses[0]?.id || "");
    }
  }, [newCourseId, state.courses]);

  const submitCard = () => {
    if (!newPrompt.trim() || !newAnswer.trim()) {
      return;
    }

    dispatch({
      type: "addFlashcard",
      card: createFlashcard({
        courseId: newCourseId || undefined,
        lessonId: newLessonId || undefined,
        tagIds: selectedTagIds,
        prompt: newPrompt,
        answer: newAnswer
      })
    });
    setNewPrompt("");
    setNewAnswer("");
    setNewLessonId("");
    setSelectedTagIds([]);
  };

  const reviewCard = (rating: FlashcardRating) => {
    if (!currentCard) {
      return;
    }

    dispatch({
      type: "reviewFlashcard",
      card: applyFlashcardReview(currentCard, rating)
    });
    setActiveCardId(null);
    setShowAnswer(false);
  };

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="Review"
          title="Train recall instead of rereading the same pages."
          description="Revision mode schedules cards by difficulty, keeps due work visible, and lets you build a durable memory layer per course."
        />
      ) : null}

      <section className="stat-grid large">
        <div className="stat-card">
          <span>Due now</span>
          <strong>{stats.due}</strong>
        </div>
        <div className="stat-card">
          <span>Learning</span>
          <strong>{stats.learning}</strong>
        </div>
        <div className="stat-card">
          <span>Fresh</span>
          <strong>{stats.fresh}</strong>
        </div>
        <div className="stat-card">
          <span>Mastered</span>
          <strong>{stats.mastered}</strong>
        </div>
      </section>

      <section className="two-column-grid">
        <div className="card review-surface">
          <div className="task-card-row">
            <div>
              <h2>Due queue</h2>
              <p className="muted">
                {activeCourse
                  ? `${activeCourse.title} filtered`
                  : "All courses"}
              </p>
            </div>
            <label className="field review-filter">
              <span>Course filter</span>
              <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                <option value="all">All courses</option>
                {state.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {currentCard ? (
            <div className="review-card">
              <div className="review-card-face">
                <p className="badge">{currentCard.state}</p>
                <div className="review-card-content">
                  <RichContent content={currentCard.prompt} />
                </div>
                <p className="muted">
                  Due {formatDateTime(currentCard.dueAt)} • {describeInterval(currentCard.intervalMinutes)}
                </p>
              </div>

              <div className={`review-card-face answer-face ${showAnswer ? "is-revealed" : ""}`}>
                {showAnswer ? (
                  <>
                    <h4>Answer</h4>
                    <div className="review-card-content">
                      <RichContent content={currentCard.answer} />
                    </div>
                  </>
                ) : (
                  <p className="muted">Reveal the answer before rating the card.</p>
                )}
              </div>

              <div className="action-row">
                {!showAnswer ? (
                  <button className="primary-button" onClick={() => setShowAnswer(true)} type="button">
                    Reveal answer
                  </button>
                ) : null}
                {ratingOptions.map((option) => (
                  <button
                    key={option.rating}
                    className={option.rating === "good" ? "primary-button" : "secondary-button"}
                    disabled={!showAnswer}
                    onClick={() => reviewCard(option.rating)}
                    type="button"
                  >
                    {option.label} · {option.detail}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="note-card">
              <strong>No cards yet</strong>
              <p className="muted">Create your first flashcard on the right to start building a review queue.</p>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2>Create flashcard</h2>
            <div className="field-grid single-column">
              <label className="field">
                <span>Course</span>
                <select value={newCourseId} onChange={(event) => setNewCourseId(event.target.value)}>
                  {state.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Lesson</span>
                <select value={newLessonId} onChange={(event) => setNewLessonId(event.target.value)}>
                  <option value="">No specific lesson</option>
                  {lessonOptions.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Prompt</span>
                <textarea rows={3} value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} />
              </label>
              <label className="field">
                <span>Answer</span>
                <textarea rows={4} value={newAnswer} onChange={(event) => setNewAnswer(event.target.value)} />
              </label>
              <div className="tag-picker">
                {state.tags.map((tag) => (
                  <button
                    key={tag.id}
                    className={`tag-toggle ${selectedTagIds.includes(tag.id) ? "is-selected" : ""}`}
                    style={{ borderColor: tag.color }}
                    onClick={() =>
                      setSelectedTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((item) => item !== tag.id)
                          : [...current, tag.id]
                      )
                    }
                    type="button"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
              <button className="primary-button" onClick={submitCard} type="button">
                Add flashcard
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Coverage by course</h2>
            <div className="goal-list">
              {stats.byCourse.map((course) => (
                <div key={course.courseId} className="goal-item">
                  <div className="goal-item-row">
                    <strong>{course.title}</strong>
                    <span>{course.due} due</span>
                  </div>
                  <small>{course.total} cards total</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="task-card-row">
          <h2>Card library</h2>
          <span className="muted">{visibleCards.length} cards in this filter</span>
        </div>
        <label className="field review-filter-field">
          <span>Search cards</span>
          <input
            placeholder="Filter by prompt, answer, or course"
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
          />
        </label>
        <div className="task-list">
          {visibleCards.map((card) => (
            <div key={card.id} className="task-card">
              <div className="task-card-row">
                <div>
                  <strong>{summarizeCard(card)}</strong>
                  <p className="muted">
                    {card.courseId
                      ? state.courses.find((course) => course.id === card.courseId)?.title || "Course"
                      : "General"}
                    {" • "}
                    Due {formatDateTime(card.dueAt)}
                  </p>
                </div>
                <span className={`status-pill status-${card.state === "review" ? "reviewed" : "current"}`}>
                  {card.state}
                </span>
              </div>
              <div className="task-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    setActiveCardId(card.id);
                    setShowAnswer(false);
                  }}
                  type="button"
                >
                  Study this
                </button>
                <button
                  className="secondary-button"
                  onClick={() => dispatch({ type: "deleteFlashcard", cardId: card.id })}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {visibleCards.length === 0 ? (
            <p className="muted">No cards match the current filter yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};
