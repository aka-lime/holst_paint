const Session = require('../../domain/entities/Session');

class RecordStrokeUseCase {
    constructor({ sessionRepository, strokeLimit }) {
        this.sessionRepository = sessionRepository;
        this.strokeLimit = strokeLimit;
    }

    async execute({ sessionId, action }) {
        if (!sessionId) {
            throw new Error('sessionId is required');
        }
        if (!action) {
            throw new Error('action is required');
        }

        const session = await this.sessionRepository.getOrCreate(
            sessionId,
            () => new Session({ id: sessionId, strokeLimit: this.strokeLimit })
        );

        const storedAction = session.addStroke(action);
        await this.sessionRepository.save(session);

        return {
            session,
            action: storedAction,
            history: session.getHistory()
        };
    }
}

module.exports = RecordStrokeUseCase;
