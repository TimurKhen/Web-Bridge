import { Transport } from "./transport";

export type Listener<T = any> = (data: T) => void;

export class Bridge<TIn = any, TOut = TIn> {
    private listeners = new Set<Listener<TIn>>();
    private transport: Transport;
    private unsubscribe: () => void;
    private destroyed = false;

    constructor(transport: Transport) {
        this.transport = transport;
        this.unsubscribe = this.transport.onMessage((message: TIn) => {
            this.notifyListeners(message);
        });
    }

    on(listener: Listener<TIn>): () => void {
        if (this.destroyed) {
            console.warn("[Bridge] Cannot add a listener to a destroyed Bridge.");
            return () => {};
        }
        this.listeners.add(listener);
        return () => this.off(listener);
    }

    off(listener: Listener<TIn>): void {
        this.listeners.delete(listener);
    }

    emit(payload: TOut): void {
        if (this.destroyed) {
            console.warn("[Bridge] Cannot emit on a destroyed Bridge.");
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

    private notifyListeners(data: TIn): void {
        [...this.listeners].forEach((listener) => {
            try {
                listener(data);
            } catch (err) {
                console.error("[WBridger] Error in listener:", err);
            }
        });
    }
}
