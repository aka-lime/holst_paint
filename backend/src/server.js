const http = require('http');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const { DATA_DIR, SESSIONS_FILE, STROKE_LIMIT } = require('./config/appConfig');
const createExpressApp = require('./interfaces/http/createExpressApp');
const SessionCookieManager = require('./interfaces/http/SessionCookieManager');
const FileSessionRepository = require('./infrastructure/persistence/FileSessionRepository');
const {
    JoinSessionUseCase,
    RecordStrokeUseCase,
    ClearSessionUseCase,
    UndoStrokeUseCase,
    GetHistoryUseCase
} = require('./application/usecases');
const createSessionSocketHandler = require('./interfaces/ws/createSessionSocketHandler');

const frontendPath = path.join(__dirname, '..', '..', 'frontend');

const sessionRepository = new FileSessionRepository({
    filePath: SESSIONS_FILE,
    dataDir: DATA_DIR,
    strokeLimit: STROKE_LIMIT
});

const useCases = {
    joinSession: new JoinSessionUseCase({ sessionRepository, strokeLimit: STROKE_LIMIT }),
    recordStroke: new RecordStrokeUseCase({ sessionRepository, strokeLimit: STROKE_LIMIT }),
    clearSession: new ClearSessionUseCase({ sessionRepository, strokeLimit: STROKE_LIMIT }),
    undoStroke: new UndoStrokeUseCase({ sessionRepository, strokeLimit: STROKE_LIMIT }),
    getHistory: new GetHistoryUseCase({ sessionRepository, strokeLimit: STROKE_LIMIT })
};

const sessionCookieManager = new SessionCookieManager({
    cookieName: 'sessionId',
    maxAge: 1000 * 60 * 60 * 24 * 30
});

const app = createExpressApp({
    frontendPath,
    sessionCookieManager,
    sessionIdGenerator: () => crypto.randomBytes(5).toString('hex')
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

createSessionSocketHandler({
    wss,
    useCases,
    logger: console
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
