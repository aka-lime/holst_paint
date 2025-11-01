window.addEventListener('load', () => {
    const canvas = document.getElementById('drawing-canvas');
    const context = canvas.getContext('2d');

    // --- Get UI Elements ---
    const sessionTitle = document.getElementById('session-title');
    const themeToggle = document.getElementById('theme-toggle');
    const colorPickerBtn = document.getElementById('color-picker-btn');
    const currentColorDisplay = document.getElementById('current-color-display');
    const customColorPanel = document.getElementById('custom-color-panel');
    const brushSizes = document.getElementById('brush-sizes');
    const eraserBtn = document.getElementById('eraser-btn');
    const clearBtn = document.getElementById('clear-btn');
    const undoBtn = document.getElementById('undo-btn');
    const controlsContainer = document.querySelector('.controls');

    let historyMaxDimensions = { width: 0, height: 0 };

    // --- State Variables ---
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    let clientHistory = [];
    let currentStrokeId = null;
    let activePointerId = null;

    // Tool states
    let currentColor = 'black';
    let currentSize = 8;
    let isErasing = false;

    // --- Session Management ---
    let sessionId = null;
    const sessionMatch = window.location.pathname.match(/\/session\/([^/]+)/);

    if (sessionMatch && sessionMatch[1]) {
        sessionId = decodeURIComponent(sessionMatch[1]);
        sessionTitle.textContent = `Session: ${sessionId}`;
    } else {
        // If we somehow land on the page without a session, go back to root
        sessionTitle.textContent = 'Redirecting to a new session...';
        window.location.replace('/');
        return;
    }

    // --- WebSocket Connection ---
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);

    socket.onopen = () => {
        if (sessionId) {
            socket.send(JSON.stringify({ type: 'join', sessionId }));
        }
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'history') {
            clientHistory = (message.data || []).map(action => ({
                ...action,
                segment: action.segment ? { ...action.segment } : action.segment
            }));
            recomputeHistoryDimensions();
            redrawCanvas();
        } else if (message.type === 'draw') {
            const action = {
                ...message.data,
                segment: message.data.segment ? { ...message.data.segment } : message.data.segment
            };
            clientHistory.push(action);
            drawSegment(action.segment);
        } else if (message.type === 'clear') {
            clientHistory = [];
            historyMaxDimensions = { width: 0, height: 0 };
            redrawCanvas();
        }
    };

    // --- Helper to send messages ---
    function sendMessage(type, data = {}) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type, sessionId, data }));
        }
    }

    // --- Canvas & Drawing Logic ---
    function redrawCanvas() {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.restore();
        clientHistory.forEach(action => drawSegment(action.segment));
    }

    function resizeCanvas() {
        const pixelRatio = window.devicePixelRatio || 1;
        const viewportScale = window.visualViewport ? window.visualViewport.scale || 1 : 1;
        const effectiveInnerWidth = window.innerWidth / viewportScale;
        const effectiveInnerHeight = window.innerHeight / viewportScale;

        const bodyStyles = window.getComputedStyle(document.body);
        const horizontalPadding = parseFloat(bodyStyles.paddingLeft || '0') + parseFloat(bodyStyles.paddingRight || '0');
        const verticalPadding = parseFloat(bodyStyles.paddingTop || '0') + parseFloat(bodyStyles.paddingBottom || '0');

        const availableWidth = Math.max(220, effectiveInnerWidth - horizontalPadding);
        const controlsHeight = controlsContainer ? controlsContainer.offsetHeight : 0;
        const titleHeight = sessionTitle ? sessionTitle.offsetHeight : 0;
        const spacingBuffer = 40; // breathing room below controls
        const availableHeight = Math.max(220, effectiveInnerHeight - controlsHeight - titleHeight - verticalPadding - spacingBuffer);
        const targetSize = Math.max(220, Math.min(availableWidth, availableHeight, 900));

        canvas.style.width = `${targetSize}px`;
        canvas.style.height = `${targetSize}px`;

        const backingStoreWidth = Math.floor(targetSize * pixelRatio);
        const backingStoreHeight = Math.floor(targetSize * pixelRatio);
        canvas.width = backingStoreWidth;
        canvas.height = backingStoreHeight;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        redrawCanvas();
    }

    function getCanvasCoords(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    function updateHistoryDimensions(segment) {
        if (!segment) return;

        const fallbackWidth = canvas.clientWidth || Math.max(segment.x0, segment.x1, historyMaxDimensions.width, 1);
        const fallbackHeight = canvas.clientHeight || Math.max(segment.y0, segment.y1, historyMaxDimensions.height, 1);

        if (!segment.canvasWidth) {
            segment.canvasWidth = fallbackWidth;
        }
        if (!segment.canvasHeight) {
            segment.canvasHeight = fallbackHeight;
        }

        historyMaxDimensions.width = Math.max(historyMaxDimensions.width, segment.canvasWidth);
        historyMaxDimensions.height = Math.max(historyMaxDimensions.height, segment.canvasHeight);
    }

    function recomputeHistoryDimensions() {
        historyMaxDimensions = { width: 0, height: 0 };
        clientHistory.forEach(action => {
            if (action && action.segment) {
                updateHistoryDimensions(action.segment);
            }
        });
    }

    function drawSegment(segment) {
        if (!segment) return;
        updateHistoryDimensions(segment);
        const baseWidth = segment.canvasWidth || historyMaxDimensions.width || canvas.clientWidth || 1;
        const baseHeight = segment.canvasHeight || historyMaxDimensions.height || canvas.clientHeight || 1;
        const scaleX = canvas.clientWidth / baseWidth;
        const scaleY = canvas.clientHeight / baseHeight;

        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(segment.x0 * scaleX, segment.y0 * scaleY);
        context.lineTo(segment.x1 * scaleX, segment.y1 * scaleY);
        context.strokeStyle = segment.color;
        const widthReference = historyMaxDimensions.width || baseWidth;
        const heightReference = historyMaxDimensions.height || baseHeight;
        const strokeScaleX = widthReference ? canvas.clientWidth / widthReference : 1;
        const strokeScaleY = heightReference ? canvas.clientHeight / heightReference : 1;
        const strokeScale = Math.max(Math.min(strokeScaleX, strokeScaleY), 0);
        context.lineWidth = segment.size * strokeScale;
        context.stroke();
        context.closePath();
    }

    function startDrawing(e) {
        if (!e.isPrimary) return;
        drawing = true;
        activePointerId = e.pointerId;
        const { x, y } = getCanvasCoords(e);
        [lastX, lastY] = [x, y];
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (err) {
            // Some browsers (older iOS Safari) do not support pointer capture
        }
        currentStrokeId = Date.now() + Math.random();
    }

    function draw(e) {
        if (!drawing || e.pointerId !== activePointerId) return;
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        const cssWidth = canvas.clientWidth || (canvas.width / (window.devicePixelRatio || 1));
        const cssHeight = canvas.clientHeight || (canvas.height / (window.devicePixelRatio || 1));
        const segment = {
            x0: lastX, y0: lastY, x1: x, y1: y,
            color: isErasing ? 'white' : currentColor,
            size: isErasing ? 20 : currentSize,
            canvasWidth: cssWidth,
            canvasHeight: cssHeight
        };
        const action = { segment, strokeId: currentStrokeId };
        clientHistory.push(action);
        drawSegment(segment);
        sendMessage('draw', { segment, strokeId: currentStrokeId });
        [lastX, lastY] = [x, y];
    }

    function stopDrawing(e) {
        if (!drawing || (e && e.pointerId !== activePointerId)) return;
        drawing = false;
        if (e) {
            try {
                canvas.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore if pointer capture was not set
            }
        }
        activePointerId = null;
    }

    // --- UI Event Listeners ---
    colorPickerBtn.addEventListener('click', () => customColorPanel.classList.toggle('visible'));

    customColorPanel.addEventListener('click', (e) => {
        if (e.target.classList.contains('swatch')) {
            isErasing = false;
            updateActiveTool(null);
            currentColor = e.target.dataset.color;
            currentColorDisplay.style.backgroundColor = currentColor;
            customColorPanel.classList.remove('visible');
        }
    });

    brushSizes.addEventListener('click', (e) => {
        if (e.target.classList.contains('brush-size')) {
            isErasing = false;
            currentSize = parseInt(e.target.dataset.size, 10);
            updateActiveTool(e.target);
        }
    });

    eraserBtn.addEventListener('click', () => {
        isErasing = true;
        updateActiveTool(eraserBtn);
    });

    undoBtn.addEventListener('click', () => sendMessage('undo'));

    clearBtn.addEventListener('click', () => {
        clientHistory = [];
        historyMaxDimensions = { width: 0, height: 0 };
        redrawCanvas();
        sendMessage('clear');
    });

    themeToggle.addEventListener('click', () => document.body.classList.toggle('dark-theme'));

    window.addEventListener('click', (e) => {
        if (!customColorPanel.contains(e.target) && !colorPickerBtn.contains(e.target)) {
            customColorPanel.classList.remove('visible');
        }
    });

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);
    window.addEventListener('pointerup', stopDrawing);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', resizeCanvas);
        window.visualViewport.addEventListener('scroll', resizeCanvas);
    }

    function updateActiveTool(selectedTool) {
        document.querySelectorAll('.active-tool').forEach(tool => tool.classList.remove('active-tool'));
        if (selectedTool) selectedTool.classList.add('active-tool');
    }

    // --- Initial Setup ---
    if (sessionId) {
        resizeCanvas();
    }
});
