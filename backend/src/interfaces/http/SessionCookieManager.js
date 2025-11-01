class SessionCookieManager {
    constructor({ cookieName, maxAge }) {
        this.cookieName = cookieName;
        this.maxAge = maxAge;
    }

    extract(req) {
        const header = req.headers && req.headers.cookie;
        if (!header) {
            return null;
        }
        const cookies = header.split(';').map(part => part.trim());
        for (const cookie of cookies) {
            const [name, value] = cookie.split('=');
            if (name === this.cookieName && value) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    persist(res, sessionId) {
        if (!sessionId) {
            return;
        }
        res.cookie(this.cookieName, sessionId, {
            maxAge: this.maxAge,
            httpOnly: false,
            sameSite: 'lax',
            path: '/'
        });
    }

    ensure(req, res, sessionIdFactory) {
        let sessionId = this.extract(req);
        if (!sessionId && sessionIdFactory) {
            sessionId = sessionIdFactory();
        }
        if (sessionId) {
            this.persist(res, sessionId);
        }
        return sessionId;
    }
}

module.exports = SessionCookieManager;
