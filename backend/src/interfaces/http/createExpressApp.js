const express = require('express');
const path = require('path');

function createExpressApp({ frontendPath, sessionCookieManager, sessionIdGenerator }) {
    if (!frontendPath) {
        throw new Error('frontendPath is required');
    }
    if (!sessionCookieManager) {
        throw new Error('sessionCookieManager is required');
    }
    if (!sessionIdGenerator) {
        throw new Error('sessionIdGenerator is required');
    }

    const app = express();

    app.get('/', (req, res) => {
        const sessionId = sessionCookieManager.ensure(req, res, sessionIdGenerator);
        res.redirect(`/session/${sessionId}`);
    });

    app.use(express.static(frontendPath));

    app.get('*', (req, res) => {
        const sessionMatch = req.path.match(/^\/session\/([^/]+)/);
        if (sessionMatch && sessionMatch[1]) {
            sessionCookieManager.persist(res, sessionMatch[1]);
        }
        res.sendFile(path.join(frontendPath, 'index.html'));
    });

    return app;
}

module.exports = createExpressApp;
