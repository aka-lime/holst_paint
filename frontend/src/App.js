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

    // --- State Variables ---
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    let clientHistory = [];
    let currentStrokeId = null;

    // Tool states
    let currentColor = 'black';
    let currentSize = 8;
    let isErasing = false;

    // --- Session Management ---
    let sessionId = null;
    const path = window.location.pathname;

    if (path.startsWith('/session/')) {
        sessionId = path.split('/')[2];
        sessionTitle.textContent = `Session: ${sessionId}`;
    } else {
        // This case should ideally not be hit if server redirect works
        sessionTitle.textContent = 'Redirecting to a new session...';
    }

    // --- WebSocket Connection ---
    const socket = new WebSocket(`ws://${window.location.host}`);

    socket.onopen = () => {
        if (sessionId) {
            socket.send(JSON.stringify({ type: 'join', sessionId }));
        }
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'history') {
            clientHistory = message.data;
            redrawCanvas();
        } else if (message.type === 'draw') {
            clientHistory.push(message.data);
            drawSegment(message.data.segment);
        } else if (message.type === 'clear') {
            clientHistory = [];
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
        context.clearRect(0, 0, canvas.width, canvas.height);
        clientHistory.forEach(action => drawSegment(action.segment));
    }

    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        redrawCanvas();
    }

    function drawSegment(segment) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(segment.x0, segment.y0);
        context.lineTo(segment.x1, segment.y1);
        context.strokeStyle = segment.color;
        context.lineWidth = segment.size;
        context.stroke();
        context.closePath();
    }

    function startDrawing(e) {
        drawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
        currentStrokeId = Date.now() + Math.random();
    }

    function draw(e) {
        if (!drawing) return;
        const segment = {
            x0: lastX, y0: lastY, x1: e.offsetX, y1: e.offsetY,
            color: isErasing ? 'white' : currentColor,
            size: isErasing ? 20 : currentSize
        };
        drawSegment(segment);
        sendMessage('draw', { segment, strokeId: currentStrokeId });
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function stopDrawing() {
        drawing = false;
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
        redrawCanvas();
        sendMessage('clear');
    });

    themeToggle.addEventListener('click', () => document.body.classList.toggle('dark-theme'));

    window.addEventListener('click', (e) => {
        if (!customColorPanel.contains(e.target) && !colorPickerBtn.contains(e.target)) {
            customColorPanel.classList.remove('visible');
        }
    });

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    window.addEventListener('resize', resizeCanvas);

    function updateActiveTool(selectedTool) {
        document.querySelectorAll('.active-tool').forEach(tool => tool.classList.remove('active-tool'));
        if (selectedTool) selectedTool.classList.add('active-tool');
    }

    // --- Initial Setup ---
    if (sessionId) {
        resizeCanvas();
    }
});
