const Session = require('../../domain/entities/Session');

class UndoStrokeUseCase {
    constructor({ sessionRepository, strokeLimit }) {
        this.sessionRepository = sessionRepository;
        this.strokeLimit = strokeLimit;
    }

    async execute({ sessionId, userId }) {
        if (!sessionId) {
            throw new Error('sessionId is required');
        }

        const session = await this.sessionRepository.getOrCreate(
            sessionId,
            () => new Session({ id: sessionId, strokeLimit: this.strokeLimit })
        );

        const success = session.undoByUser(userId);
        if (success) {
            await this.sessionRepository.save(session);
        }

        return {
            session,
            history: session.getHistory(),
            undone: success
        };
    }
}

module.exports = UndoStrokeUseCase;
