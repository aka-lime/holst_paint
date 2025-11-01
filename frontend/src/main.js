import CanvasView from './presentation/CanvasView.js';
import SocketClient from './infrastructure/socketClient.js';
import DrawingController from './application/DrawingController.js';
import { extractSessionId } from './utils/session.js';

async function bootstrap() {
    const sessionId = extractSessionId(window.location.pathname);
    if (!sessionId) {
        window.location.replace('/');
        return;
    }

    const view = new CanvasView();
    const socketClient = new SocketClient({ sessionId });
    const controller = new DrawingController({ sessionId, view, socketClient });

    try {
        await controller.init();
    } catch (error) {
        console.error('Failed to initialize drawing controller', error);
    }
}

window.addEventListener('load', bootstrap);
