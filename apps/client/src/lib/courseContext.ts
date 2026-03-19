import type { AppState, Course, CourseMaterialMeta, Lesson, Note } from "@orbital/domain";

const trimText = (value: string, max = 1_000) =>
  value.length <= max ? value : `${value.slice(0, max)}...`;

const summarizeMaterial = (material: CourseMaterialMeta) => {
  const preview = material.extractedText ? ` | ${trimText(material.extractedText, 220)}` : "";
  return `${material.kind.toUpperCase()}: ${material.name}${preview}`;
};

const summarizeNote = (note: Note) => `${note.title}: ${trimText(note.body, 240)}`;

const lessonMaterials = (course: Course, lessonId?: string) =>
  course.materials.filter(
    (material) =>
      !lessonId || material.lessonIds.length === 0 || material.lessonIds.includes(lessonId)
  );

const lessonNotes = (course: Course, lessonId?: string) =>
  course.notes.filter((note) => !lessonId || note.linkedLessonIds.length === 0 || note.linkedLessonIds.includes(lessonId));

export const buildCourseContextSummary = (course: Course) => {
  const lessons = course.lessons
    .map((lesson) => `Week ${lesson.week}: ${lesson.title} | ${lesson.objectives.join("; ")}`)
    .join("\n");
  const materials = course.materials.slice(0, 6).map(summarizeMaterial).join("\n");
  const notes = course.notes.slice(0, 4).map(summarizeNote).join("\n");

  return [
    `Course: ${course.title} (${course.code})`,
    `Discipline: ${course.discipline}`,
    `Overview: ${course.overview}`,
    lessons ? `Lesson map:\n${lessons}` : "",
    materials ? `Recent materials:\n${materials}` : "",
    notes ? `Recent notes:\n${notes}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const buildLessonContextSummary = (course: Course, lesson: Lesson) => {
  const relatedMaterials = lessonMaterials(course, lesson.id).slice(0, 6).map(summarizeMaterial).join("\n");
  const relatedNotes = lessonNotes(course, lesson.id).slice(0, 4).map(summarizeNote).join("\n");

  return [
    `Course: ${course.title} (${course.code})`,
    `Lesson: Week ${lesson.week} - ${lesson.title}`,
    `Status: ${lesson.status}`,
    `Objectives:\n${lesson.objectives.map((objective) => `- ${objective}`).join("\n")}`,
    relatedMaterials ? `Related materials:\n${relatedMaterials}` : "",
    relatedNotes ? `Linked notes:\n${relatedNotes}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
};

export const buildSelectedCoursesContext = (state: AppState, courseIds: string[]) =>
  courseIds
    .map((courseId) => state.courses.find((course) => course.id === courseId))
    .filter((course): course is Course => Boolean(course))
    .map((course) => buildCourseContextSummary(course))
    .join("\n\n---\n\n");
