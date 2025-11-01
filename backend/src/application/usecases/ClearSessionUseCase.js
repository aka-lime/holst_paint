const Session = require('../../domain/entities/Session');

class ClearSessionUseCase {
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

        session.clear();
        await this.sessionRepository.save(session);

        return {
            session,
            history: session.getHistory()
        };
    }
}

module.exports = ClearSessionUseCase;
