import {Transport} from "../transport";

export interface Message<P = unknown> {
    type: string;
    payload?: P;
}

export function messagePort<T>(iframe: HTMLIFrameElement): Transport<T> {
    const channel = new MessageChannel();
    let initialized = false;

    const initHandshake = () => {
        if (initialized) return;
        if (!iframe.contentWindow) {
            throw new Error("iframe.contentWindow is not accessible");
        }

        iframe.contentWindow.postMessage({type: "__INIT_PORT__"}, "*", [channel.port2,]);
        initialized = true;
    };

    return {
        send(data: T) {
            if (!initialized) {
                initHandshake();
            }
            channel.port1.postMessage(data);
        }, onMessage(handler: (data: T) => void) {
            const listener = (event: MessageEvent) => handler(event.data);
            channel.port1.onmessage = listener;

            return () => {
                if (channel.port1.onmessage === listener) {
                    channel.port1.onmessage = null;
                }
            };
        }, terminate() {
            channel.port1.close();
        },
    };
}


export function acceptMessagePort<T>(): Promise<Transport<T>> {
    return new Promise((resolve) => {
        const handleHandshake = (event: MessageEvent) => {

            if (event.data?.type === '__INIT_PORT__' && event.ports[0]) {
                window.removeEventListener('message', handleHandshake);

                const port = event.ports[0];

                resolve({
                    send(data: T) {
                        port.postMessage(data);
                    }, onMessage(handler: (data: T) => void) {
                        const listener = (e: MessageEvent) => handler(e.data);
                        port.onmessage = listener;

                        return () => {
                            if (port.onmessage === listener) {
                                port.onmessage = null;
                            }
                        };
                    },

                    terminate() {
                        port.close();
                    }
                });
            }
        };

        window.addEventListener('message', handleHandshake);
    });
}
