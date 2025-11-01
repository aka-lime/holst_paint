export default class CanvasView {
    constructor() {
        this.canvas = document.getElementById('drawing-canvas');
        this.context = this.canvas.getContext('2d');
        this.sessionTitle = document.getElementById('session-title');
        this.themeToggle = document.getElementById('theme-toggle');
        this.colorPickerBtn = document.getElementById('color-picker-btn');
        this.currentColorDisplay = document.getElementById('current-color-display');
        this.customColorPanel = document.getElementById('custom-color-panel');
        this.brushSizes = document.getElementById('brush-sizes');
        this.eraserBtn = document.getElementById('eraser-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.controlsContainer = document.querySelector('.controls');
    }

    bindUIHandlers(handlers) {
        const {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onPointerLeave,
            onColorPickerToggle,
            onColorSelected,
            onBrushSelected,
            onEraser,
            onUndo,
            onClear,
            onThemeToggle,
            onOutsideClick
        } = handlers;

        if (onPointerDown) this.canvas.addEventListener('pointerdown', onPointerDown);
        if (onPointerMove) this.canvas.addEventListener('pointermove', onPointerMove);
        if (onPointerUp) this.canvas.addEventListener('pointerup', onPointerUp);
        if (onPointerCancel) this.canvas.addEventListener('pointercancel', onPointerCancel);
        if (onPointerLeave) this.canvas.addEventListener('pointerleave', onPointerLeave);

        if (onColorPickerToggle) this.colorPickerBtn.addEventListener('click', onColorPickerToggle);
        if (onColorSelected) {
            this.customColorPanel.addEventListener('click', (event) => {
                if (event.target.classList.contains('swatch')) {
                    const color = event.target.dataset.color;
                    onColorSelected(color);
                }
            });
        }
        if (onBrushSelected) {
            this.brushSizes.addEventListener('click', (event) => {
                if (event.target.classList.contains('brush-size')) {
                    const size = parseInt(event.target.dataset.size, 10);
                    onBrushSelected(size);
                }
            });
        }
        if (onEraser) this.eraserBtn.addEventListener('click', onEraser);
        if (onUndo) this.undoBtn.addEventListener('click', onUndo);
        if (onClear) this.clearBtn.addEventListener('click', onClear);
        if (onThemeToggle) this.themeToggle.addEventListener('click', onThemeToggle);
        if (onOutsideClick) {
            window.addEventListener('click', (event) => {
                if (!this.customColorPanel.contains(event.target) && !this.colorPickerBtn.contains(event.target)) {
                    onOutsideClick();
                }
            });
        }
    }

    getCanvasElement() {
        return this.canvas;
    }

    getControlsContainer() {
        return this.controlsContainer;
    }

    getContext() {
        return this.context;
    }

    setCanvasSize(size, pixelRatio) {
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;
        this.canvas.width = Math.floor(size * pixelRatio);
        this.canvas.height = Math.floor(size * pixelRatio);
        this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    clearCanvas() {
        this.context.save();
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.restore();
    }

    drawRenderableSegment(segment) {
        if (!segment) {
            return;
        }
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';
        this.context.strokeStyle = segment.color;
        this.context.lineWidth = segment.lineWidth;
        this.context.beginPath();
        this.context.moveTo(segment.x0, segment.y0);
        this.context.lineTo(segment.x1, segment.y1);
        this.context.stroke();
        this.context.closePath();
    }

    redraw(renderableSegments) {
        this.clearCanvas();
        renderableSegments.forEach(segment => this.drawRenderableSegment(segment));
    }

    setSessionTitle(sessionId) {
        if (sessionId) {
            this.sessionTitle.textContent = `Session: ${sessionId}`;
        }
    }

    setCurrentColor(color) {
        this.currentColorDisplay.style.backgroundColor = color;
    }

    openColorPanel() {
        this.customColorPanel.classList.add('visible');
    }

    closeColorPanel() {
        this.customColorPanel.classList.remove('visible');
    }

    toggleColorPanel() {
        this.customColorPanel.classList.toggle('visible');
    }

    markBrushSize(size) {
        const elements = this.brushSizes.querySelectorAll('.brush-size');
        elements.forEach(element => {
            element.classList.toggle('active-tool', parseInt(element.dataset.size, 10) === size);
        });
        this.eraserBtn.classList.remove('active-tool');
    }

    markEraserActive() {
        this.eraserBtn.classList.add('active-tool');
        this.brushSizes.querySelectorAll('.brush-size').forEach(element => element.classList.remove('active-tool'));
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
    }

    capturePointer(pointerId) {
        try {
            this.canvas.setPointerCapture(pointerId);
        } catch (error) {
            // ignore when not supported
        }
    }

    releasePointer(pointerId) {
        try {
            this.canvas.releasePointerCapture(pointerId);
        } catch (error) {
            // ignore
        }
    }

    getCanvasCoords(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
}
