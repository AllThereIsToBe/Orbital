# Roadmap

## Already working

- Focus timer with course, task, and tag attachment
- Local task planner with prioritization suggestions
- Course dashboards with lessons, notes, chats, and material upload
- Analytics by time window, course, tag, and goal
- Configurable AI providers and workflow runner

## Next implementation steps

1. Add a Rust-backed persistence layer using SQLite for the desktop build.
2. Introduce ingestion workers for PDFs, images, and audio so materials become searchable, chunked study assets rather than stored files.
3. Add course-specific chat threads backed by retrieval over uploaded materials.
4. Expose scheduling intelligence with calendar import and daily plan generation.
5. Split the domain package into bounded contexts once the collaboration backend is added.
