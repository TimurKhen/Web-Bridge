# transport-contract

A tiny, transport-agnostic pub/sub wrapper for messaging across an iframe, a Web Worker, or any custom channel you point it at. You give it a `Transport` (something that can `send`, `onMessage`, and optionally `terminate`), and it gives you a `Contract`: a small event emitter with proper cleanup.

- Zero dependencies
- ESM + CJS builds, with type declarations
- Built-in transports for `postMessage`/`MessageChannel` (iframe) and `Worker`
- Bring your own transport for anything else (BroadcastChannel, WebSocket, etc.)

## Install

```bash
npm install transport-contract
```

## Quick start

### Talking to a Web Worker

```ts
import { Contract, workerTransport } from "transport-contract";

const worker = new Worker(new URL("./worker.js", import.meta.url));
const contract = new Contract(workerTransport(worker));

const unsubscribe = contract.on((message) => {
  console.log("from worker:", message);
});

contract.emit({ type: "ping" });

// later, when you're done with this contract:
unsubscribe();   // stop listening, keep the contract/worker alive
contract.destroy(); // tear everything down, including the worker
```

### Talking to an iframe

```ts
import { Contract, messagePort } from "transport-contract";

const iframe = document.querySelector("iframe")!;
const contract = new Contract(messagePort(iframe));

contract.on((message) => console.log("from iframe:", message));
contract.emit({ type: "hello" });
```

On the iframe's side, listen for the `__INIT_PORT__` handshake message and grab the transferred `MessagePort` from `event.ports[0]` to complete the connection.

## API

### `new Contract(transport)`

Wraps a `Transport` in a small pub/sub interface.

| Method | Description |
| --- | --- |
| `on(listener)` | Subscribes to incoming messages. Returns an `unsubscribe` function. |
| `off(listener)` | Removes a specific listener. |
| `emit(payload)` | Sends a payload through the transport. |
| `destroy()` | Clears all listeners, unsubscribes from the transport, and calls `transport.terminate?.()`. Safe to call multiple times. |

Once `destroy()` has been called, `emit()` and `on()` become no-ops (they log a warning instead of throwing), so you don't have to guard every call site against a torn-down contract.

### `Transport` interface

Implement this to support a new messaging channel:

```ts
interface Transport {
  send(data: { uuid: string; payload: any }): void;
  onMessage(handler: (data: any) => void): () => void; // must return an unsubscribe fn
  terminate?(): void;
}
```

`onMessage` **must** return a function that detaches the handler — `Contract` relies on this to release its internal references on `destroy()`. See [DEVELOPMENT.md](./DEVELOPMENT.md) for why this matters.

### Built-in transports

- `workerTransport(worker: Worker): Transport` — wraps a `Worker`.
- `messagePort(iframe: HTMLIFrameElement): Transport` — wraps a `MessageChannel` handshake with an iframe.

## Cleaning up

Always call `destroy()` (or at least the `unsubscribe` returned by `on()`) when you're done with a `Contract`, especially in frameworks that mount/unmount components repeatedly. Forgetting this is the single most common source of leaked listeners and, for the worker transport, orphaned workers still running in the background.

## License

MIT
