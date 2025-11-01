export default class SocketClient {
    constructor({ sessionId }) {
        this.sessionId = sessionId;
        this.socket = null;
        this.listeners = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const socket = new WebSocket(`${protocol}://${window.location.host}`);
            this.socket = socket;

            socket.addEventListener('open', () => {
                this.#emit('open');
                this.send('join');
                resolve();
            });

            socket.addEventListener('message', (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.#emit(message.type, message.data);
                } catch (error) {
                    this.#emit('error', error);
                }
            });

            socket.addEventListener('close', () => {
                this.#emit('close');
            });

            socket.addEventListener('error', (error) => {
                this.#emit('error', error);
                reject(error);
            });
        });
    }

    on(eventType, handler) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(handler);
    }

    off(eventType, handler) {
        const handlers = this.listeners.get(eventType);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    send(type, data = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        this.socket.send(JSON.stringify({ type, sessionId: this.sessionId, data }));
    }

    close() {
        if (this.socket) {
            this.socket.close();
        }
    }

    #emit(eventType, payload) {
        const handlers = this.listeners.get(eventType);
        if (!handlers) {
            return;
        }
        handlers.forEach(handler => handler(payload));
    }
}
