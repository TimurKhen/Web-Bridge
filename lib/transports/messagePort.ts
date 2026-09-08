import {Transport} from "../transport";

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
                channel.port1.close();
            };
        },
        terminate() {
            channel.port1.close();
        },
    };
}
