import {Transport} from "./transport";
type Listener<T> = (data: T) => void;

export class createContract {
    private listeners = new Set<Listener<any>>();
    private transport: Transport;

    constructor(transport: Transport) {
        this.transport = transport;

        this.transport.onMessage((data) => {
            this.listeners.forEach((listener) => listener(data));
        });
    }

    on(listener: Listener<any>) {
        this.listeners.add(listener);

        return () => this.off(listener);
    }

    off(listener: Listener<any>): void {
        this.listeners.delete(listener);
    }

    emit(payload: any) {
        this.transport.send(payload);
    }
}
