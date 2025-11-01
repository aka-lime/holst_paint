const Session = require('../../domain/entities/Session');

class JoinSessionUseCase {
    constructor({ sessionRepository, strokeLimit }) {
        this.sessionRepository = sessionRepository;
        this.strokeLimit = strokeLimit;
    }

    async execute({ sessionId }) {
        if (!sessionId) {
            throw new Error('sessionId is required');
        }

        const session = await this.sessionRepository.getOrCreate(
            sessionId,
            () => new Session({ id: sessionId, strokeLimit: this.strokeLimit })
        );

        return {
            session,
            history: session.getHistory()
        };
    }
}

module.exports = JoinSessionUseCase;
