import {Transport} from "../transport";

export function broadcast<T>(channelName: string): Transport<T> {
    const bc = new BroadcastChannel(channelName);

    return {
        send(data: T) {
            bc.postMessage(data);
        },
        onMessage(handler: (data: T) => void) {
            const listener = (event: MessageEvent) => {
                handler(event.data);
            };

            bc.addEventListener('message', listener);

            return () => {
                bc.removeEventListener('message', listener);
            };
        },
        terminate() {
            bc.close();
        },
    };
}
