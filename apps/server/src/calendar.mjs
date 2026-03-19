import { randomUUID } from "node:crypto";

import ical from "node-ical";

import {
  clearCalendarSourceEvents,
  createCalendarSource,
  deleteCalendarSource,
  getCalendarEvents,
  getCalendarSourcesByName,
  insertCalendarEvent
} from "./db.mjs";

export const importIcsCalendar = (userId, name, icsText) => {
  const existingSources = getCalendarSourcesByName.all(userId, name, "ics", "manual");

  for (const row of existingSources) {
    deleteCalendarSource.run(row.id);
  }

  const sourceId = createCalendarSource(userId, name, "ics", "manual");
  clearCalendarSourceEvents.run(sourceId);

  const parsed = ical.sync.parseICS(icsText);
  const events = [];

  for (const value of Object.values(parsed)) {
    if (value.type !== "VEVENT") {
      continue;
    }

    const event = {
      id: randomUUID(),
      sourceId,
      userId,
      externalId: value.uid || null,
      title: value.summary || "Untitled event",
      startAt: value.start?.toISOString() || new Date().toISOString(),
      endAt: value.end?.toISOString() || null,
      location: value.location || null,
      description: value.description || null,
      courseHint: value.summary || null,
      tags: []
    };

    insertCalendarEvent.run(
      event.id,
      sourceId,
      userId,
      event.externalId,
      event.title,
      event.startAt,
      event.endAt,
      event.location,
      event.description,
      event.courseHint,
      JSON.stringify(event.tags)
    );
    events.push(event);
  }

  return events;
};

export const listCalendarEvents = (userId) =>
  getCalendarEvents.all(userId).map((row) => ({
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    description: row.description,
    courseHint: row.course_hint,
    tags: JSON.parse(row.tags_json || "[]")
  }));
