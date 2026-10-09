import {Transport} from "../transport";

export function workerTransport(worker: Worker): Transport {
    return {
        send(data: any) {
            worker.postMessage(data);
        },

        onMessage(handler: (data: any) => void) {
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
