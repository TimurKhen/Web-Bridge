# web-bridger

A tiny, transport-agnostic pub/sub wrapper for messaging across an iframe, a Web Worker, or any custom channel you point it at.

You give it a `Transport` (something that can `send`, `onMessage`, and optionally `terminate`), and it gives you a `Bridge`: a small event emitter with proper cleanup.

* Zero dependencies
* ESM + CJS builds, with type declarations
* Built-in transports for `postMessage`/`MessageChannel` (iframe) and `Worker`
* Bring your own transport for anything else (BroadcastChannel, WebSocket, etc.)

## Install

```bash
npm install web-bridger
```

## Quick start

### Talking to a Web Worker

```ts
import { Bridge, workerTransport } from "web-bridger";

const worker = new Worker(new URL("./worker.js", import.meta.url));
const bridge = new Bridge(workerTransport(worker));

const unsubscribe = bridge.on((message) => {
  console.log("from worker:", message);
});

bridge.emit({ type: "ping" });

// later, when you're done with this bridge:
unsubscribe();   // stop listening, keep the bridge/worker alive
bridge.destroy(); // tear everything down, including the worker
```

### Talking to an iframe

From the **parent window**, initiate the connection by passing the iframe element:

```ts
import { Bridge, messagePort } from "web-bridger";

const iframe = document.querySelector("iframe")!;
const bridge = new Bridge(messagePort(iframe));

bridge.on((message) => console.log("from iframe:", message));
bridge.emit({ type: "hello" });
```

Inside the **iframe**, await the connection handshake to get a ready-to-use transport:

```ts
import { Bridge, acceptMessagePort } from "web-bridger";

async function initIframe() {
  // Wait for the parent to send the MessagePort
  const transport = await acceptMessagePort();
  const bridge = new Bridge(transport);

  bridge.on((message) => console.log("from parent:", message));
  bridge.emit({ type: "hi parent!" });
}

initIframe();
```

## API

### `new Bridge(transport)`

Wraps a `Transport` in a small pub/sub interface.

| Method | Description | 
| ----- | ----- | 
| `on(listener)` | Subscribes to incoming messages. Returns an `unsubscribe` function. | 
| `off(listener)` | Removes a specific listener. | 
| `emit(payload)` | Sends a payload through the transport. | 
| `destroy()` | Clears all listeners, unsubscribes from the transport, and calls `transport.terminate?.()`. Safe to call multiple times. | 

Once `destroy()` has been called, `emit()` and `on()` become no-ops (they log a warning instead of throwing), so you don't have to guard every call site against a torn-down bridge.

### `Transport` interface

Implement this to support a new messaging channel:

```ts
interface Transport {
  send(data: { uuid: string; payload: any }): void;
  onMessage(handler: (data: any) => void): () => void; // must return an unsubscribe fn
  terminate?(): void;
}
```

`onMessage` **must** return a function that detaches the handler — `Bridge` relies on this to release its internal references on `destroy()`. See [DEVELOPMENT.md](./DEVELOPMENT.md) for why this matters.

### Built-in transports

* `workerTransport(worker: Worker): Transport` — wraps a `Worker`.
* `messagePort(iframe: HTMLIFrameElement): Transport` — wraps a `MessageChannel` handshake with an iframe (parent side).
* `acceptMessagePort(): Promise<Transport>` — awaits and resolves the `MessageChannel` handshake (iframe side).

## Cleaning up

Always call `destroy()` (or at least the `unsubscribe` returned by `on()`) when you're done with a `Bridge`, especially in frameworks that mount/unmount components repeatedly. Forgetting this is the single most common source of leaked listeners and, for the worker transport, orphaned workers still running in the background.

## License

MIT
