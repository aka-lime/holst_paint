# Collaborative Drawing App

This project is a real-time collaborative drawing tool split into a backend (Node.js) and a frontend (vanilla ES modules). The codebase now follows a clean architecture layout so that domain rules remain decoupled from frameworks or delivery mechanisms.

## Project Structure

```
backend/
  src/
    application/        # Use cases coordinating domain logic
    config/             # Environment-driven configuration
    domain/             # Core entities and invariants
    infrastructure/     # Implementations of ports (persistence, etc.)
    interfaces/         # Framework adapters (HTTP, WebSocket)
frontend/
  src/
    application/        # Controllers orchestrating UI + infrastructure
    domain/             # UI-oriented domain state (drawing session)
    infrastructure/     # Gateways (WebSocket client)
    presentation/       # View layer and DOM bindings
    utils/              # Shared helpers
```

## Backend Layers

- **Domain** — Pure business objects such as `Session`. They enforce invariants (e.g., the stroke limit) without depending on Express or WebSocket APIs.
- **Application** — Use cases (`JoinSession`, `RecordStroke`, `ClearSession`, `UndoStroke`, `GetHistory`) that coordinate repositories and domain entities.
- **Infrastructure** — Concrete adapters like `FileSessionRepository` that persist sessions to disk.
- **Interfaces** — Delivery mechanisms: Express HTTP app (static assets + session routing) and WebSocket handlers for real-time collaboration.

`backend/src/server.js` wires these layers together, injects dependencies, and starts the HTTP and WebSocket servers.

## Frontend Layers

- **Domain** — `DrawingState` keeps the local session history, stroke metadata, and scaling calculations independent of the UI toolkit.
- **Application** — `DrawingController` glues together state, views, and infrastructure.
- **Infrastructure** — `SocketClient` handles WebSocket communication with the backend.
- **Presentation** — `CanvasView` owns DOM elements and rendering on the `<canvas>`.

`frontend/src/main.js` bootstraps the controller for the current session.

## Running Locally

```bash
npm install
npm start
```

By default the server listens on `http://localhost:3000`. Each visit to `/` issues a persistent session identifier (stored in a cookie) and redirects to `/session/<id>`. Sessions are stored on disk using a file repository (`backend/data/sessions.json`) so drawings survive restarts.

## Environment

Optional variables:

- `STROKE_LIMIT` — Maximum strokes retained per session (default `300`).
- `DATA_DIR` / `SESSIONS_FILE` — Override storage locations if you run on persistent volumes.

## Testing

Automated tests are not yet provided. To validate changes, run the app locally and interact with it in multiple browser windows. Consider adding unit tests around the domain layer (`Session`) or the frontend domain state (`DrawingState`) for future coverage.
