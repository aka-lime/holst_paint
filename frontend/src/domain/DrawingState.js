export default class DrawingState {
    constructor({ initialColor = 'black', initialSize = 8 } = {}) {
        this.currentColor = initialColor;
        this.currentSize = initialSize;
        this.isErasing = false;
        this.history = [];
        this.historyDimensions = { width: 0, height: 0 };
        this.drawing = false;
        this.lastPoint = { x: 0, y: 0 };
        this.activePointerId = null;
        this.currentStrokeId = null;
    }

    setColor(color) {
        this.currentColor = color;
        this.isErasing = false;
    }

    setBrushSize(size) {
        this.currentSize = size;
        this.isErasing = false;
    }

    enableEraser() {
        this.isErasing = true;
    }

    startStroke(pointerId, point) {
        this.drawing = true;
        this.activePointerId = pointerId;
        this.lastPoint = { ...point };
        this.currentStrokeId = Date.now() + Math.random();
        return this.currentStrokeId;
    }

    createSegment(point, canvasMetrics) {
        if (!this.drawing) {
            return null;
        }
        const segment = {
            x0: this.lastPoint.x,
            y0: this.lastPoint.y,
            x1: point.x,
            y1: point.y,
            color: this.isErasing ? 'white' : this.currentColor,
            size: this.isErasing ? 20 : this.currentSize,
            canvasWidth: canvasMetrics.width,
            canvasHeight: canvasMetrics.height
        };
        this.lastPoint = { ...point };
        return segment;
    }

    stopStroke(pointerId) {
        if (pointerId != null && pointerId !== this.activePointerId) {
            return;
        }
        this.drawing = false;
        this.activePointerId = null;
        this.currentStrokeId = null;
    }

    isDrawing(pointerId) {
        if (!this.drawing) {
            return false;
        }
        if (pointerId == null) {
            return this.drawing;
        }
        return this.activePointerId === pointerId;
    }

    getCurrentStrokeId() {
        return this.currentStrokeId;
    }

    setHistory(history) {
        this.history = Array.isArray(history) ? history.map(action => ({ ...action, segment: action.segment ? { ...action.segment } : action.segment })) : [];
        this.#recomputeHistoryDimensions();
    }

    appendAction(action) {
        if (!action) {
            return;
        }
        const stored = { ...action, segment: action.segment ? { ...action.segment } : action.segment };
        this.history.push(stored);
        this.#updateHistoryDimensions(stored.segment);
    }

    clearHistory() {
        this.history = [];
        this.historyDimensions = { width: 0, height: 0 };
    }

    getHistory() {
        return this.history.map(action => ({ ...action, segment: action.segment ? { ...action.segment } : action.segment }));
    }

    getHistoryDimensions() {
        return { ...this.historyDimensions };
    }

    createRenderableSegment(segment, canvasWidth, canvasHeight) {
        if (!segment) {
            return null;
        }
        const baseWidth = segment.canvasWidth || this.historyDimensions.width || canvasWidth || 1;
        const baseHeight = segment.canvasHeight || this.historyDimensions.height || canvasHeight || 1;
        const scaleX = canvasWidth / baseWidth;
        const scaleY = canvasHeight / baseHeight;
        const widthReference = this.historyDimensions.width || baseWidth;
        const heightReference = this.historyDimensions.height || baseHeight;
        const strokeScaleX = widthReference ? canvasWidth / widthReference : 1;
        const strokeScaleY = heightReference ? canvasHeight / heightReference : 1;
        const strokeScale = Math.max(Math.min(strokeScaleX, strokeScaleY), 0);

        return {
            x0: segment.x0 * scaleX,
            y0: segment.y0 * scaleY,
            x1: segment.x1 * scaleX,
            y1: segment.y1 * scaleY,
            color: segment.color,
            lineWidth: segment.size * strokeScale
        };
    }

    #updateHistoryDimensions(segment) {
        if (!segment) {
            return;
        }
        const width = segment.canvasWidth || Math.max(segment.x0, segment.x1, this.historyDimensions.width, 1);
        const height = segment.canvasHeight || Math.max(segment.y0, segment.y1, this.historyDimensions.height, 1);
        this.historyDimensions.width = Math.max(this.historyDimensions.width, width);
        this.historyDimensions.height = Math.max(this.historyDimensions.height, height);
    }

    #recomputeHistoryDimensions() {
        this.historyDimensions = { width: 0, height: 0 };
        this.history.forEach(action => {
            if (action.segment) {
                this.#updateHistoryDimensions(action.segment);
            }
        });
    }
}
