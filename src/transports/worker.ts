import { Transport } from "../transport";

export function workerTransport<T>(worker: Worker): Transport<T> {
    return {
        send(data: T) {
            worker.postMessage(data);
        },

        onMessage(handler: (data: T) => void) {
            const listener = (event: MessageEvent) => {
                handler(event.data);
            };

            worker.addEventListener('message', listener);

            return () => {
                worker.removeEventListener('message', listener);
            };
        },

        terminate() {
            worker.terminate();
        }
    };
}

export function createWorker<T>(): Transport<T> {
    return {
        send(data: T) {
            self.postMessage(data);
        },

        onMessage(handler: (data: T) => void) {
            const listener = (event: MessageEvent) => handler(event.data);
            self.addEventListener('message', listener);

            return () => self.removeEventListener('message', listener);
        },

        terminate() {
            self.close();
        }
    };
}
