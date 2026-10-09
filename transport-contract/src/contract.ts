import { Transport } from "./transport";

export type Listener<T = any> = (data: T) => void;

export class Bridge<TResponse = any> {
    private listeners = new Set<Listener<TResponse>>();
    private transport: Transport;
    private unsubscribe: () => void;
    private destroyed = false;

    constructor(transport: Transport) {
        this.transport = transport;
        this.unsubscribe = this.transport.onMessage((message) => {
            this.notifyListeners(message);
        });
    }

    on(listener: Listener<TResponse>): () => void {
        if (this.destroyed) {
            console.warn("[WBridger] Cannot add a listener to a destroyed bridge");
            return () => {};
        }
        this.listeners.add(listener);
        return () => this.off(listener);
    }

    off(listener: Listener<TResponse>): void {
        this.listeners.delete(listener);
    }

    emit(payload: any): void {
        if (this.destroyed) {
            console.warn("[WBridger] Cannot emit on a destroyed bridge");
            return;
        }
        this.transport.send(payload);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.listeners.clear();
        this.unsubscribe();
        this.transport.terminate?.();
    }

    private notifyListeners(data: TResponse): void {
        [...this.listeners].forEach((listener) => {
            try {
                listener(data);
            } catch (err) {
                console.error("[WBridger] Error in listener:", err);
            }
        });
    }
}
