const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const frontendPath = path.join(__dirname, '..', '..', 'frontend');
const HISTORY_LIMIT = 1000;

// --- Session Management ---
const sessions = {};
// sessions object structure:
// { 
//   'sessionId': {
//     history: [],
//     clients: new Set()
//   }
// }

// --- HTTP Routing ---

// 1. Handle root path by redirecting to a new session. This must be first.
app.get('/', (req, res) => {
    const newSessionId = crypto.randomBytes(5).toString('hex');
    res.redirect(`/session/${newSessionId}`);
});

// 2. Serve static files (e.g., App.js, images, etc.)
app.use(express.static(frontendPath));

// 3. For any other path, serve the main index.html file.
// This is the catch-all for SPA routing (handles /session/abc, /session/def, etc.)
app.get('*', (req, res) => {
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
                    break;

                case 'clear':
                    session.history = [];
                    broadcastToOthers(JSON.stringify({ type: 'clear' }));
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
                    break;
            }
        }
    });

    ws.on('close', () => {
        if (ws.sessionId && sessions[ws.sessionId]) {
            sessions[ws.sessionId].clients.delete(ws);
            // Optional: Clean up empty sessions
            if (sessions[ws.sessionId].clients.size === 0) {
                delete sessions[ws.sessionId];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
