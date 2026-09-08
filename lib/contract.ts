import { Transport } from "./transport";

export type Listener<T = any> = (data: T) => void;

export class Contract<TResponse = any> {
    private listeners = new Set<Listener<TResponse>>();
    private transport: Transport;

    constructor(transport: Transport) {
        this.transport = transport;
        this.transport.onMessage((message) => {
            this.notifyListeners(message);
        } )
    }

    on(listener: Listener<TResponse>): () => void {
        this.listeners.add(listener);
        return () => this.off(listener);
    }

    off(listener: Listener<TResponse>): void {
        this.listeners.delete(listener);
    }

    emit(payload: any): void {
        this.transport.send(payload);
    }

    destroy(): void {
        this.listeners.clear();
        this.transport.terminate?.();
    }

    private notifyListeners(data: TResponse): void {
        [...this.listeners].forEach((listener) => {
            try {
                listener(data);
            } catch (err) {
                console.error("[Contract] Error in listener:", err);
            }
        });
    }
}
