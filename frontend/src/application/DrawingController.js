import DrawingState from '../domain/DrawingState.js';

export default class DrawingController {
    constructor({ sessionId, view, socketClient }) {
        this.sessionId = sessionId;
        this.view = view;
        this.socketClient = socketClient;
        this.state = new DrawingState();

        this.handleResize = this.handleResize.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
    }

    async init() {
        this.view.setSessionTitle(this.sessionId);
        this.view.setCurrentColor(this.state.currentColor);
        this.view.markBrushSize(this.state.currentSize);
        this.registerUIHandlers();
        this.registerViewportHandlers();
        this.handleResize();
        this.registerSocketHandlers();
        await this.socketClient.connect();
    }

    registerUIHandlers() {
        this.view.bindUIHandlers({
            onPointerDown: this.handlePointerDown,
            onPointerMove: this.handlePointerMove,
            onPointerUp: this.handlePointerUp,
            onPointerCancel: this.handlePointerCancel,
            onPointerLeave: this.handlePointerCancel,
            onColorPickerToggle: () => this.view.toggleColorPanel(),
            onColorSelected: (color) => this.handleColorSelected(color),
            onBrushSelected: (size) => this.handleBrushSelected(size),
            onEraser: () => this.handleEraserSelected(),
            onUndo: () => this.handleUndo(),
            onClear: () => this.handleClear(),
            onThemeToggle: () => this.view.toggleTheme(),
            onOutsideClick: this.handleOutsideClick
        });
    }

    registerViewportHandlers() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.handleResize);
            window.visualViewport.addEventListener('scroll', this.handleResize);
        }
    }

    registerSocketHandlers() {
        this.socketClient.on('history', (history) => {
            this.state.setHistory(history);
            this.renderFullHistory();
        });

        this.socketClient.on('draw', (action) => {
            this.state.appendAction(action);
            this.renderSegment(action.segment);
        });

        this.socketClient.on('clear', () => {
            this.state.clearHistory();
            this.view.clearCanvas();
        });
    }

    handlePointerDown(event) {
        if (!event.isPrimary) {
            return;
        }
        const point = this.view.getCanvasCoords(event);
        this.state.startStroke(event.pointerId, point);
        this.view.capturePointer(event.pointerId);
    }

    handlePointerMove(event) {
        if (!this.state.isDrawing(event.pointerId)) {
            return;
        }
        event.preventDefault();
        const point = this.view.getCanvasCoords(event);
        const metrics = this.getCanvasMetrics();
        const segment = this.state.createSegment(point, metrics);
        if (!segment) {
            return;
        }
        const strokeId = this.state.getCurrentStrokeId();
        this.state.appendAction({ segment, strokeId });
        this.renderSegment(segment);
        this.socketClient.send('draw', { segment, strokeId });
    }

    handlePointerUp(event) {
        this.state.stopStroke(event.pointerId);
        this.view.releasePointer(event.pointerId);
    }

    handlePointerCancel(event) {
        this.state.stopStroke(event.pointerId);
        this.view.releasePointer(event.pointerId);
    }

    handleColorSelected(color) {
        this.state.setColor(color);
        this.view.setCurrentColor(color);
        this.view.closeColorPanel();
    }

    handleBrushSelected(size) {
        this.state.setBrushSize(size);
        this.view.markBrushSize(size);
    }

    handleEraserSelected() {
        this.state.enableEraser();
        this.view.markEraserActive();
    }

    handleUndo() {
        this.socketClient.send('undo');
    }

    handleClear() {
        this.state.clearHistory();
        this.view.clearCanvas();
        this.socketClient.send('clear');
    }

    handleOutsideClick() {
        this.view.closeColorPanel();
    }

    handleResize() {
        const pixelRatio = window.devicePixelRatio || 1;
        const viewportScale = window.visualViewport ? window.visualViewport.scale || 1 : 1;
        const bodyStyles = window.getComputedStyle(document.body);
        const horizontalPadding = parseFloat(bodyStyles.paddingLeft || '0') + parseFloat(bodyStyles.paddingRight || '0');
        const verticalPadding = parseFloat(bodyStyles.paddingTop || '0') + parseFloat(bodyStyles.paddingBottom || '0');
        const controlsHeight = this.view.getControlsContainer() ? this.view.getControlsContainer().offsetHeight : 0;
        const titleElement = document.getElementById('session-title');
        const titleHeight = titleElement ? titleElement.offsetHeight : 0;
        const spacingBuffer = 40;

        const effectiveInnerWidth = window.innerWidth / viewportScale;
        const effectiveInnerHeight = window.innerHeight / viewportScale;

        const availableWidth = Math.max(220, effectiveInnerWidth - horizontalPadding);
        const availableHeight = Math.max(220, effectiveInnerHeight - controlsHeight - titleHeight - verticalPadding - spacingBuffer);
        const targetSize = Math.max(220, Math.min(availableWidth, availableHeight, 900));

        this.view.setCanvasSize(targetSize, pixelRatio);
        this.renderFullHistory();
    }

    renderFullHistory() {
        const metrics = this.getCanvasMetrics();
        const renderables = this.state.getHistory()
            .map(action => this.state.createRenderableSegment(action.segment, metrics.width, metrics.height))
            .filter(Boolean);
        this.view.redraw(renderables);
    }

    renderSegment(segment) {
        const metrics = this.getCanvasMetrics();
        const renderable = this.state.createRenderableSegment(segment, metrics.width, metrics.height);
        if (renderable) {
            this.view.drawRenderableSegment(renderable);
        }
    }

    getCanvasMetrics() {
        const canvas = this.view.getCanvasElement();
        return {
            width: canvas.clientWidth || canvas.width,
            height: canvas.clientHeight || canvas.height
        };
    }
}
