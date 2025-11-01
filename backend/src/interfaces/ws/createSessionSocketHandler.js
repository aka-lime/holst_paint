const WebSocket = require('ws');

function createSessionSocketHandler({ wss, useCases, logger = console }) {
    if (!wss) {
        throw new Error('WebSocket server instance is required');
    }
    const {
        joinSession,
        recordStroke,
        clearSession,
        undoStroke,
        getHistory
    } = useCases;

    const sessionClients = new Map();

    function getClientSet(sessionId) {
        if (!sessionClients.has(sessionId)) {
            sessionClients.set(sessionId, new Set());
        }
        return sessionClients.get(sessionId);
    }

    function broadcast(sessionId, message, { exclude } = {}) {
        const clients = sessionClients.get(sessionId);
        if (!clients) {
            return;
        }
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        clients.forEach(client => {
            if (exclude && client === exclude) {
                return;
            }
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }

    wss.on('connection', (ws) => {
        ws.id = `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        ws.sessionId = null;
        ws.userId = Date.now() + Math.random();

        ws.on('message', async (rawMessage) => {
            let message;
            try {
                message = JSON.parse(rawMessage);
            } catch (error) {
                logger.warn('Failed to parse message', error);
                return;
            }
            const { type, sessionId, data } = message;

            try {
                switch (type) {
                    case 'join': {
                        const result = await joinSession.execute({ sessionId });
                        ws.sessionId = sessionId;
                        getClientSet(sessionId).add(ws);
                        ws.send(JSON.stringify({ type: 'history', data: result.history }));
                        break;
                    }
                    case 'draw': {
                        if (!ws.sessionId || ws.sessionId !== sessionId) {
                            return;
                        }
                        const result = await recordStroke.execute({
                            sessionId,
                            action: {
                                segment: data.segment,
                                strokeId: data.strokeId,
                                userId: ws.userId
                            }
                        });
                        broadcast(sessionId, { type: 'draw', data: result.action }, { exclude: ws });
                        break;
                    }
                    case 'clear': {
                        if (!ws.sessionId || ws.sessionId !== sessionId) {
                            return;
                        }
                        await clearSession.execute({ sessionId });
                        broadcast(sessionId, { type: 'clear' }, { exclude: ws });
                        break;
                    }
                    case 'undo': {
                        if (!ws.sessionId || ws.sessionId !== sessionId) {
                            return;
                        }
                        const result = await undoStroke.execute({ sessionId, userId: ws.userId });
                        if (result.undone) {
                            broadcast(sessionId, { type: 'history', data: result.history });
                        }
                        break;
                    }
                    case 'history-request': {
                        if (!sessionId) {
                            return;
                        }
                        const result = await getHistory.execute({ sessionId });
                        ws.send(JSON.stringify({ type: 'history', data: result.history }));
                        break;
                    }
                    default:
                        logger.warn('Unhandled message type', type);
                        break;
                }
            } catch (error) {
                logger.error('Failed to process message', error);
            }
        });

        ws.on('close', () => {
            if (!ws.sessionId) {
                return;
            }
            const clients = sessionClients.get(ws.sessionId);
            if (clients) {
                clients.delete(ws);
                if (clients.size === 0) {
                    sessionClients.delete(ws.sessionId);
                }
            }
        });
    });

    return {
        broadcast
    };
}

module.exports = createSessionSocketHandler;
