# Architecture

## Product shape

Orbital is structured as a local-first study operating system with a shared frontend and a desktop shell.

- `apps/client` owns the product surface and can ship directly to the browser.
- `apps/desktop` wraps the same frontend in a native-feeling Tauri window.
- `packages/domain` is the shared domain model for courses, focus, tasks, tags, goals, and AI workflows.
- `packages/storage` is the local persistence boundary and can later be replaced with sync-capable adapters.

## Current behavior

- Focus sessions are first-class records that attach to tasks, courses, and tags.
- Course spaces keep raw files, lessons, note surfaces, and chat threads separate but connected.
- Uploaded files are stored in IndexedDB, while metadata stays in the main application state.
- AI providers are explicit configuration objects rather than SDK-specific logic scattered through the UI.
- Workflow execution uses an OpenAI-compatible API boundary so remote and local model backends can coexist.

## Expansion path

### Retrieval and material intelligence

Move ingestion into a Rust or service-side worker layer:

- Parse text-based files and PDF structure into canonical chunks.
- Attach chunk metadata to course, lesson, concept, and source-document lineage.
- Add OCR and transcription workers for images and audio.
- Persist embeddings and chunk references in SQLite or Postgres depending on deployment mode.

### Collaboration

Add a service layer with the same domain contracts:

- Shared auth and friend graph
- Synced focus sessions and tasks
- Shared course workspaces
- Leaderboards and friend filters
- Background workflow execution and notifications

### Desktop-native features

Use Tauri plugins and Rust commands for:

- Secure secret storage for provider API keys
- Native notifications and focus-mode hooks
- File system watchers for course folders
- Offline sync queues and background processing
