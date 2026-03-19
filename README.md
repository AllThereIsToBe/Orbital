# Orbital

Orbital is a modular study and productivity platform designed as a local-first academic command center with a clear path to desktop and web deployment.

## What is implemented

- Focus-centric home experience with Pomodoro and custom deep-work sessions
- Local-first task, course, tag, goal, and analytics model
- SQLite-backed Orbital server for auth, sync, social data, and calendar import
- Course spaces with lessons, notes, chat threads, raw material uploads, and indexed retrieval
- IndexedDB-backed local material storage with automatic server upload when signed in
- AI provider registry with OpenAI-compatible and Ollama-friendly configuration
- Multi-step workflow runner for summaries, quizzes, tutoring, and exam prep
- Server-backed course chat over indexed material chunks
- Friend requests and leaderboard aggregation over synced focus sessions
- ICS calendar import for lecture and deadline visibility
- Tauri desktop shell scaffold wired to the shared web client

## Monorepo layout

- `apps/client`: React + TypeScript web app that also serves as the Tauri frontend
- `apps/desktop`: Tauri shell and Rust entrypoint
- `apps/server`: Node + SQLite API for auth, sync, retrieval, calendar, and social features
- `packages/domain`: shared study/productivity domain model and recommendation logic
- `packages/storage`: local persistence helpers
- `docs`: architecture notes and expansion path

## Run locally

1. Install dependencies at the repo root with `npm install`.
2. Start the Orbital API server with `npm run server:start`.
3. Start the web client with `npm run dev`.
4. After Rust is installed, start the desktop shell with `npm run tauri:dev`.
5. Build the macOS desktop artifacts with `npm run tauri:build`.

## Current scope

This foundation is intentionally local-first but now supports a real sync path. The desktop app still works alone for private local use, while the Orbital server unlocks shared leaderboards, auth, calendar import, server-backed course chat, and synchronized state.

The desktop packaging script builds the native `.app` with Tauri and then creates both a `.dmg` and a `.tar.gz` archive of `Orbital.app`. The tarball is the simpler "extract and run" option when you do not want the DMG install flow.
