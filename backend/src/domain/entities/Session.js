class Session {
    constructor({ id, history = [], strokeLimit = 300 } = {}) {
        if (!id) {
            throw new Error('Session id is required');
        }
        this.id = id;
        this.strokeLimit = strokeLimit;
        this.history = Array.isArray(history) ? history.map(action => ({ ...action })) : [];
        this.#enforceStrokeLimit();
    }

    addStroke(action) {
        this.#assertAction(action);
        this.history.push({ ...action });
        this.#enforceStrokeLimit();
        return this.history[this.history.length - 1];
    }

    clear() {
        this.history = [];
    }

    undoByUser(userId) {
        if (userId == null) {
            return false;
        }

        let targetStrokeId = null;
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].userId === userId) {
                targetStrokeId = this.history[i].strokeId;
                break;
            }
        }

        if (targetStrokeId == null) {
            return false;
        }

        this.history = this.history.filter(action => action.strokeId !== targetStrokeId);
        return true;
    }

    getHistory() {
        return this.history.map(action => ({ ...action }));
    }

    toJSON() {
        return {
            id: this.id,
            history: this.getHistory()
        };
    }

    #assertAction(action) {
        if (!action || typeof action !== 'object') {
            throw new Error('Action must be an object');
        }
        if (!action.segment || typeof action.segment !== 'object') {
            throw new Error('Action segment is required');
        }
        if (action.strokeId == null) {
            throw new Error('Action strokeId is required');
        }
        if (action.userId == null) {
            throw new Error('Action userId is required');
        }
    }

    #enforceStrokeLimit() {
        if (!Number.isFinite(this.strokeLimit)) {
            return;
        }
        const keepIds = [];
        const seen = new Set();
        for (let i = this.history.length - 1; i >= 0 && keepIds.length < this.strokeLimit; i--) {
            const { strokeId } = this.history[i];
            if (strokeId == null) {
                continue;
            }
            if (!seen.has(strokeId)) {
                seen.add(strokeId);
                keepIds.push(strokeId);
            }
        }
        const keepSet = new Set(keepIds);
        this.history = this.history.filter(action => keepSet.has(action.strokeId));
    }
}

module.exports = Session;
