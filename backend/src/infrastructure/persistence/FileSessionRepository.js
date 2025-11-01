const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const SessionRepository = require('../../application/ports/SessionRepository');
const Session = require('../../domain/entities/Session');

class FileSessionRepository extends SessionRepository {
    constructor({ filePath, strokeLimit, dataDir }) {
        super();
        this.filePath = filePath;
        this.strokeLimit = strokeLimit;
        this.dataDir = dataDir || path.dirname(filePath);
        this.sessions = new Map();
        this.persistTimer = null;
        this.#ensureDataDir();
        this.#hydrate();
    }

    async get(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? new Session({ id: session.id, history: session.getHistory(), strokeLimit: this.strokeLimit }) : null;
    }

    async save(session) {
        if (!session || !session.id) {
            throw new Error('Cannot save session without id');
        }
        this.sessions.set(session.id, session);
        await this.#schedulePersist();
        return session;
    }

    async getOrCreate(sessionId, factory) {
        if (!sessionId) {
            throw new Error('sessionId is required');
        }
        const existing = this.sessions.get(sessionId);
        if (existing) {
            return existing;
        }
        const session = factory ? factory() : new Session({ id: sessionId, strokeLimit: this.strokeLimit });
        this.sessions.set(sessionId, session);
        await this.#schedulePersist();
        return session;
    }

    async delete(sessionId) {
        if (!sessionId) {
            return;
        }
        if (this.sessions.delete(sessionId)) {
            await this.#schedulePersist();
        }
    }

    async #schedulePersist() {
        if (this.persistTimer) {
            return this.persistTimer.promise;
        }
        let resolveFn;
        let rejectFn;
        const promise = new Promise((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        this.persistTimer = { promise };
        setTimeout(async () => {
            try {
                await this.#persistToDisk();
                resolveFn();
            } catch (error) {
                rejectFn(error);
            } finally {
                this.persistTimer = null;
            }
        }, 100);
        return promise;
    }

    async #persistToDisk() {
        const payload = {};
        for (const [sessionId, session] of this.sessions.entries()) {
            payload[sessionId] = session.toJSON();
        }
        await fsp.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
    }

    #ensureDataDir() {
        fs.mkdirSync(this.dataDir, { recursive: true });
    }

    #hydrate() {
        try {
            const raw = fs.readFileSync(this.filePath, 'utf8');
            if (!raw) {
                return;
            }
            const data = JSON.parse(raw);
            Object.entries(data).forEach(([sessionId, value]) => {
                const history = value && Array.isArray(value.history) ? value.history : [];
                const session = new Session({ id: sessionId, history, strokeLimit: this.strokeLimit });
                this.sessions.set(sessionId, session);
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                return;
            }
            console.warn('Failed to hydrate sessions from disk:', error);
        }
    }
}

module.exports = FileSessionRepository;
