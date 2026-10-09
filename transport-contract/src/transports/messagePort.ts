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

            // Detach the handler only. Closing the port is terminate()'s
            // job — a consumer that unsubscribes to swap handlers shouldn't
            // also tear down the underlying channel.
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
