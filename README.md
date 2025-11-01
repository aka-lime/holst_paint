# Collaborative Drawing App

A real-time collaborative whiteboard where multiple participants draw together in the same browser session. The project is organised according to Clean Architecture principles so that pure domain rules stay framework-agnostic and every external concern (networking, persistence, UI) lives behind its own adapter.

## Key Features

- **Live collaboration** – peers connected to the same session instantly see each other’s strokes via WebSockets.
- **Persistent sessions** – drawings are stored on disk allowing the board to survive server restarts (configurable storage path).
- **Undo & clear** – every user can undo their latest stroke; anyone can clear the canvas.
- **Touch-first UX** – pointer events, high-DPI scaling, and responsive layout ensure a pleasant experience on phones, tablets, and desktops.
- **Session reuse** – returning visitors automatically rejoin their previous session thanks to a persistent cookie.

## Technology Stack

| Area      | Technology |
|-----------|------------|
| Runtime   | Node.js (18+ recommended)
| Backend   | Express, ws (WebSocket)
| Frontend  | Vanilla ES modules, Canvas API, Pointer Events
| Persistence | JSON file storage (pluggable)

## Getting Started

### Prerequisites

- Node.js ≥ 18 (LTS recommended)
- npm ≥ 9

### Installation

```bash
npm install
```

### Running in Development

```bash
npm start
```

Navigate to `http://localhost:3000/`. The root route issues a unique session ID and redirects you to `/session/<id>`. Open the same URL in multiple tabs or devices to collaborate.

> **Tip:** If the port is already taken (common when restarting quickly), free it with `lsof -i :3000` → `kill <pid>` before re-running `npm start`.

## Project Layout

```
backend/
  src/
    application/        # Use cases orchestrating domain logic
    config/             # Environment-driven configuration
    domain/             # Core entities & business rules
    infrastructure/     # Adapters (e.g. persistence implementations)
    interfaces/         # Framework-facing delivery code (HTTP, WS)
    server.js           # Composition root / entry point
frontend/
  src/
    application/        # Controllers combining UI + infrastructure
    domain/             # Drawing session state & invariants
    infrastructure/     # Gateways (WebSocket client, etc.)
    presentation/       # View layer bound to DOM & Canvas
    utils/              # Shared helpers
    main.js             # Frontend bootstrapper
```

Assets such as icons or images live in `frontend/src/assets/`.

## Clean Architecture Overview

### Backend Layers

- **Domain** (`backend/src/domain/`)
  - `Session` entity encapsulates drawing history, stroke limits, and undo logic.
  - Entities are pure JavaScript and contain no framework calls.
- **Application** (`backend/src/application/`)
  - Use cases (`JoinSession`, `RecordStroke`, `ClearSession`, `UndoStroke`, `GetHistory`) orchestrate entities through abstract ports.
  - Each use case is dependency-injected with the `SessionRepository` port.
- **Infrastructure** (`backend/src/infrastructure/`)
  - `FileSessionRepository` persists sessions to JSON on disk; drop-in replacements (Redis, SQL) can be implemented without touching use cases.
- **Interfaces** (`backend/src/interfaces/`)
  - `http/` exposes the app via Express (session routing, cookie management, static frontend serving).
  - `ws/` wires the WebSocket server to use cases, broadcasting changes to connected clients.
- **Composition Root** (`backend/src/server.js`)
  - Assembles adapters, configures dependencies, and starts the HTTP/WebSocket servers.

### Frontend Layers

- **Domain** (`frontend/src/domain/`)
  - `DrawingState` maintains local history, stroke metadata, and scaling calculations independently of the DOM.
- **Application** (`frontend/src/application/`)
  - `DrawingController` coordinates UI events, WebSocket traffic, and domain state.
- **Infrastructure** (`frontend/src/infrastructure/`)
  - `SocketClient` wraps the browser WebSocket API and exposes a simple pub/sub interface.
- **Presentation** (`frontend/src/presentation/`)
  - `CanvasView` binds to DOM nodes, performs all drawing on the `<canvas>`, and exposes imperative helpers used by the controller.
- **Bootstrap** (`frontend/src/main.js`)
  - Extracts the session ID from the URL, instantiates dependencies, and launches the controller.

## Data & Message Flow

1. **HTTP layer** redirects `/` to `/session/<id>` while persisting the id in a cookie (`sessionId`).
2. **Frontend bootstrap** retrieves the session ID, initialises the view/controller/state stack, and opens a WebSocket connection.
3. **`join` message** triggers the `JoinSessionUseCase`, which loads or creates the session and returns the full history to the client.
4. **Drawing**: each pointer move produces a `draw` message `{ segment, strokeId }`. The backend appends the stroke, enforces stroke limits, persists, and broadcasts to peers.
5. **Undo/Clear**: application use cases update the domain entity, persist it, and broadcast either a `history` (for undo) or `clear` event.
6. **Persistence**: the repository batches writes to `backend/data/sessions.json`. The storage path can be changed via environment variables or swapped for another adapter.

## WebSocket Protocol

All messages are JSON objects containing `type`, `sessionId`, and optional `data`.

| Type             | Direction | Payload (`data`)                                        | Description |
|------------------|-----------|----------------------------------------------------------|-------------|
| `join`           | client→server | –                                                      | Join the given session; server replies with `history` |
| `history`        | server→client | `Array<{ segment, strokeId, userId }>`                 | Full drawing history for the session |
| `draw`           | client→server | `{ segment, strokeId }`                                | Append a segment belonging to a stroke |
| `draw`           | server→client | `{ segment, strokeId, userId }`                        | Broadcast of a stroke segment from another user |
| `undo`           | client→server | –                                                      | Request undo of caller’s last stroke |
| `clear`          | client→server | –                                                      | Clear the entire canvas |
| `clear`          | server→client | –                                                      | Notify clients to clear their canvas |
| `history-request`| client→server | –                                                      | Explicit history refresh (rarely needed) |

Segments include coordinates relative to the canvas size at creation time along with the active colour/brush size, plus `canvasWidth/Height` for scale-independent rendering.

## Configuration

Environment variables can be supplied via shell (`STROKE_LIMIT=500 npm start`) or `.env` loader (if you add one).

| Variable         | Default                             | Description |
|------------------|-------------------------------------|-------------|
| `PORT`           | `3000`                              | HTTP/WebSocket port |
| `STROKE_LIMIT`   | `300`                               | Max strokes retained per session |
| `DATA_DIR`       | `<repo>/backend/data`               | Directory for persisted session data |
| `SESSIONS_FILE`  | `<DATA_DIR>/sessions.json`          | Concrete file path used by the file repository |

When deploying to ephemeral environments (serverless, some PaaS), switch to a persistent adapter (Redis, SQL, S3, etc.) and inject it by implementing the `SessionRepository` port.

## Frontend Behaviour

- **Responsive layout** – canvas size is computed dynamically from viewport dimensions, accounting for UI chrome and browser zoom (`visualViewport`).
- **Pointer events** – a single event path supports mouse, stylus, and multi-touch (primary pointer only) across devices.
- **High DPI** – the backing canvas scales with `devicePixelRatio` to avoid blurriness on Retina/HiDPI displays.
- **Tooling** – built-in colour palette, brush sizes, eraser, undo, clear, and theme toggle.

## Development Tips

- **Resetting state** – delete `backend/data/sessions.json` (or the configured path) to remove stored drawings.
- **Hot reload** – currently not configured; use `npm start` alongside a watcher like `nodemon` if desired.
- **Module boundaries** – keep domain/application layers free of DOM, Express, or ws references. Add new adapters inside `interfaces/` (backend) or `presentation/` (frontend).

## Testing

Automated tests are not included yet. Suggested next steps:

- Unit-test `backend/src/domain/entities/Session.js` for stroke limits, undo, and validation.
- Unit-test `frontend/src/domain/DrawingState.js` for scaling logic.
- Integration-test WebSocket flows with tools such as `ws` in Node or Playwright for end-to-end coverage.

## Deployment Guide

1. **Build artefact**: the project ships as plain Node/ES modules—no build step required.
2. **Persist sessions**: ensure `DATA_DIR` points to a mounted volume or replace the repository with a durable backend (Redis, SQL).
3. **Reverse proxy**: front with Nginx/Caddy/Traefik to terminate TLS and proxy both HTTP and WebSocket traffic to the Node process.
4. **Process manager**: use `pm2`, `forever`, or systemd to keep the Node server alive.
5. **Scaling**: sessions live in-memory per process. For multi-instance deployments, use a shared store (Redis) and broadcast bus (Redis Pub/Sub) to fan-out WebSocket events.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EADDRINUSE: :::3000` | Another process still listens on port 3000 | Terminate the process (`lsof -i :3000`, `kill <pid>`) or change `PORT` |
| Canvas appears cropped on mobile | Browser zoom or orientation change before canvas resize | Toggling orientation or reloading should refit; confirm `visualViewport` support |
| Sessions disappear after deploy | Ephemeral filesystem in hosting environment | Configure `DATA_DIR` on a persistent volume or swap in another repository implementation |
| WebSocket blocked under HTTPS | Mixed-content policy | The client automatically selects `wss://`; ensure TLS termination forwards WebSockets |

## Contributing

1. Fork & clone the repository.
2. Create a feature branch.
3. Keep changes within the appropriate layer (domain/application/infrastructure/interfaces).
4. Add tests where practical.
5. Submit a pull request describing the change and any configuration impact.

## Future Enhancements

- Multi-user cursors or presence indicators.
- Authentication / invite links for private sessions.
- Alternate storage adapters (Redis, PostgreSQL, S3 snapshots).
- Export/import drawings (PNG, SVG).
- Automated test suite and CI pipeline.

---

Feel free to adapt the layers or replace adapters to match your deployment needs—the Clean Architecture layout makes the application’s core behaviour portable and testable.
