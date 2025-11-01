const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const frontendPath = path.join(__dirname, '..', '..', 'frontend');
const HISTORY_LIMIT = 1000;
const SESSION_COOKIE_NAME = 'sessionId';
const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days
const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// --- Session Management ---
fs.mkdirSync(DATA_DIR, { recursive: true });

const hydrateSessionsFromDisk = () => {
    try {
        const fileContents = fs.readFileSync(SESSIONS_FILE, 'utf8');
        const raw = JSON.parse(fileContents);
        const hydrated = {};
        Object.entries(raw).forEach(([sessionId, payload]) => {
            hydrated[sessionId] = {
                history: Array.isArray(payload.history) ? payload.history : [],
                clients: new Set()
            };
        });
        return hydrated;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn('Unable to read sessions file, starting fresh:', error);
        }
        return {};
    }
};

const sessions = hydrateSessionsFromDisk();

const snapshotSessions = () => {
    const snapshot = {};
    Object.entries(sessions).forEach(([sessionId, session]) => {
        snapshot[sessionId] = { history: session.history };
    });
    return snapshot;
};

let persistTimer = null;
const schedulePersistSessions = () => {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        try {
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(snapshotSessions(), null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to persist sessions:', error);
        }
    }, 200);
};

// sessions object structure:
// { 
//   'sessionId': {
//     history: [],
//     clients: new Set()
//   }
// }

const extractCookieValue = (cookieHeader = '', name) => {
    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .map(part => part.split('='))
        .filter(([cookieName]) => cookieName === name)
        .map(([, value]) => value)
        .shift() || null;
};

const persistSessionCookie = (res, sessionId) => {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
        maxAge: SESSION_COOKIE_MAX_AGE,
        httpOnly: false,
        sameSite: 'lax',
        path: '/'
    });
};

// --- HTTP Routing ---

// 1. Handle root path by redirecting to a new session. This must be first.
app.get('/', (req, res) => {
    const existingSessionId = extractCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
    const sessionId = existingSessionId || crypto.randomBytes(5).toString('hex');
    persistSessionCookie(res, sessionId);
    res.redirect(`/session/${sessionId}`);
});

// 2. Serve static files (e.g., App.js, images, etc.)
app.use(express.static(frontendPath));

// 3. For any other path, serve the main index.html file.
// This is the catch-all for SPA routing (handles /session/abc, /session/def, etc.)
app.get('*', (req, res) => {
    const sessionMatch = req.path.match(/^\/session\/([^/]+)/);
    if (sessionMatch && sessionMatch[1]) {
        persistSessionCookie(res, sessionMatch[1]);
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- WebSocket Logic ---
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { sessionId, type } = data;

        if (type === 'join') {
            if (!sessions[sessionId]) {
                sessions[sessionId] = { history: [], clients: new Set() };
                schedulePersistSessions();
            } else if (!sessions[sessionId].clients) {
                sessions[sessionId].clients = new Set();
            }
            const session = sessions[sessionId];
            session.clients.add(ws);
            // Still store sessionId and userId on ws for close events and undo
            ws.sessionId = sessionId;
            ws.userId = Date.now() + Math.random();

            ws.send(JSON.stringify({ type: 'history', data: session.history }));

        } else if (sessionId && sessions[sessionId]) {
            // Use the session from the message payload for all actions
            const session = sessions[sessionId];

            const broadcast = (message) => {
                session.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            };

            const broadcastToOthers = (message) => {
                session.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            };

            switch (type) {
                case 'draw':
                    const action = { segment: data.data.segment, userId: ws.userId, strokeId: data.data.strokeId };
                    session.history.push(action);
                    if (session.history.length > HISTORY_LIMIT) {
                        session.history.shift();
                    }
                    broadcastToOthers(JSON.stringify({ type: 'draw', data: action }));
                    schedulePersistSessions();
                    break;

                case 'clear':
                    session.history = [];
                    broadcastToOthers(JSON.stringify({ type: 'clear' }));
                    schedulePersistSessions();
                    break;

                case 'undo':
                    let lastUserAction = null;
                    for (let i = session.history.length - 1; i >= 0; i--) {
                        // ws.userId is still needed here to identify the user
                        if (session.history[i].userId === ws.userId) {
                            lastUserAction = session.history[i];
                            break;
                        }
                    }
                    if (lastUserAction) {
                        const strokeIdToUndo = lastUserAction.strokeId;
                        session.history = session.history.filter(action => action.strokeId !== strokeIdToUndo);
                    }
                    broadcast(JSON.stringify({ type: 'history', data: session.history }));
                    schedulePersistSessions();
                    break;
            }
        }
    });

    ws.on('close', () => {
        if (ws.sessionId && sessions[ws.sessionId]) {
            sessions[ws.sessionId].clients.delete(ws);
            // Keep session history even if everyone disconnects
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
