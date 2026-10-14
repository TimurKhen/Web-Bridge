import {Transport} from "./transport";

export type Listener<T = any> = (data: T) => void;

export class Bridge<TIn = any, TOut = TIn> {
    private listeners = new Set<Listener<TIn>>();
    private transport: Transport<TIn | TOut>;
    private unsubscribe: () => void;
    private destroyed = false;

    constructor(transport: Transport<TIn | TOut>) {
        this.transport = transport;

        this.unsubscribe = this.transport.onMessage((message) => {
            this.notifyListeners(message as TIn);
        });
    }

    on(listener: Listener<TIn>): () => void {
        if (this.destroyed) {
            console.warn("[WebBridge] Cannot add a listener to a destroyed Bridge.");
            return () => {
            };
        }
        this.listeners.add(listener);
        return () => this.off(listener);
    }

    off(listener: Listener<TIn>): void {
        this.listeners.delete(listener);
    }

    emit(payload: TOut): void {
        if (this.destroyed) {
            console.warn("[WebBridge] Cannot emit on a destroyed Bridge.");
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
                console.error("[WebBridge] Error in listener:", err);
            }
        });
    }
}
