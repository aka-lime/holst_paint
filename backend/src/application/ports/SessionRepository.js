class SessionRepository {
    async get(sessionId) {
        throw new Error('Method not implemented');
    }

    async save(session) {
        throw new Error('Method not implemented');
    }

    async getOrCreate(sessionId, createFn) {
        throw new Error('Method not implemented');
    }

    async delete(sessionId) {
        throw new Error('Method not implemented');
    }
}

module.exports = SessionRepository;
