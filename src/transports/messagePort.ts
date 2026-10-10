import { Transport } from "../transport";

export function messagePort(iframe: HTMLIFrameElement): Transport {
    const channel = new MessageChannel();
    let initialized = false;

    const initHandshake = () => {
        if (initialized) return;
        if (!iframe.contentWindow) {
            throw new Error("iframe.contentWindow is not accessible");
        }

        iframe.contentWindow.postMessage({ type: "__INIT_PORT__" }, "*", [
            channel.port2,
        ]);
        initialized = true;
    };

    return {
        send(data: any) {
            if (!initialized) {
                initHandshake();
            }
            channel.port1.postMessage(data);
        },
        onMessage(handler: (data: any) => void) {
            const listener = (event: MessageEvent) => handler(event.data);
            channel.port1.onmessage = listener;

            return () => {
                if (channel.port1.onmessage === listener) {
                    channel.port1.onmessage = null;
                }
            };
        },
        terminate() {
            channel.port1.close();
        },
    };
}

export function acceptMessagePort(): Promise<Transport> {
    return new Promise((resolve) => {
        const handleHandshake = (event: MessageEvent) => {
            if (event.data?.type === '__INIT_PORT__' && event.ports[0]) {
                window.removeEventListener('message', handleHandshake);

                const port = event.ports[0];

                resolve({
                    send(data: any) {
                        port.postMessage(data);
                    },
                    onMessage(handler: (data: any) => void) {
                        const listener = (e: MessageEvent) => handler(e.data);
                        port.onmessage = listener;
                        return () => { port.onmessage = null; };
                    }
                });
            }
        };

        window.addEventListener('message', handleHandshake);
    });
}

export interface Message {
    type: string;
    payload: any;
}


/**
 * Here Message type is needed because we need to make handshake:
 * `
 *  type: __INIT_PORT__
 *  payload: ''
 * `
 *
 * You can make AutoHandshake by using:
 *
 * ``` TypeScript
 * const transport = await acceptMessagePort();
 * const bridge = new Bridge<Message>(transport);
 * ```
 *
 * before work started
 */
