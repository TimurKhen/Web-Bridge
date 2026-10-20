<p align="center">
  <img src="https://github.com/TimurKhen/Web-Bridge/blob/main/assets/logo.jpg" width="250" alt="web-bridger logo" />
</p>


# web-bridger 0.1.1

A tiny, type-safe, transport-agnostic pub/sub wrapper for messaging across an iframe, a Web Worker, tabs (`BroadcastChannel`), or any custom channel you point it at.

You give it a `Transport<T>` (something that can `send`, `onMessage`, and optionally `terminate`), and it gives you a `Bridge<TIn, TOut>`: a small event emitter with strict TypeScript generics and proper memory cleanup.

* **Zero dependencies**
* **TypeScript declarations**
* **Symmetric & directional typing** via `Bridge<TIn, TOut>`
* **Built-in transports** for `Worker` (both main & worker contexts), `MessageChannel` (iframe parent & child handshake), and `BroadcastChannel`
* **Easy to create your own transport** for anything else (WebSocket, WebRTC, Electron IPC, etc.)

## Install

```bash
npm install web-bridger
```

## Quick start

### 1. Talking to a Web Worker

**In the main thread (`main.ts`):**
```ts
import { Bridge, workerTransport } from "web-bridger";

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const bridge = new Bridge(workerTransport(worker));

const unsubscribe = bridge.on((message) => {
  console.log("from worker:", message);
});

bridge.emit({ type: "PING", payload: "Hello Worker!" });

// Later, when you're done with this bridge:
unsubscribe();    // stop listening, keep the bridge/worker alive
bridge.destroy(); // tear everything down, including terminating the worker
```

**Inside the worker (`worker.ts`):**
Use `createWorker()` to automatically bind to the worker's global `self` context:
```ts
import { Bridge, createWorker } from "web-bridger";

const bridge = new Bridge(createWorker());

bridge.on((message) => {
  if (message.type === "PING") {
    bridge.emit({ type: "PONG", payload: "Hello from Worker!" });
  }
});
```

---

### 2. Talking to an iframe (`MessageChannel`)

From the **parent window**, initiate the connection by passing the `HTMLIFrameElement`:

```ts
import { Bridge, messagePort } from "web-bridger";

const iframe = document.querySelector("iframe")!;

iframe.addEventListener("load", () => {
  const bridge = new Bridge(messagePort(iframe));

  bridge.on((message) => console.log("from iframe:", message));
  bridge.emit({ type: "HELLO" });
});
```

Inside the **iframe**, await the connection handshake using `acceptMessagePort()` to get a ready-to-use transport:

```ts
import { Bridge, acceptMessagePort } from "web-bridger";

async function initIframe() {
  // Wait for the parent window to transfer the MessagePort
  const transport = await acceptMessagePort();
  const bridge = new Bridge(transport);

  bridge.on((message) => console.log("from parent:", message));
  bridge.emit({ type: "HI_PARENT" });
}

initIframe();
```

---

### 3. Cross-Tab Communication (`BroadcastChannel`)

Sync state or events across multiple browser tabs, windows, or workers sharing the same origin:

```ts
import { Bridge, broadcast } from "web-bridger";

const tabBridge = new Bridge<string>(broadcast("app_sync_channel"));

tabBridge.on((msg) => {
  console.log("Received from another tab:", msg);
});

tabBridge.emit("User logged in!");
```

---

## Type-Safe Messaging (`Bridge<TIn, TOut>`)

`Bridge` accepts up to two generic type parameters:
* **`TIn`** — The type of messages **received** in `.on(listener)`
* **`TOut`** (defaults to `TIn`) — The type of payloads **sent** via `.emit(payload)`

### Single Shared Type
Pass one type when both sides send and receive the same format (primitives, objects, or discriminated unions):
```ts
const typedBridge = new Bridge<number, string>(broadcast("chat"));

// OK:
typedBridge.on((message: number) => {
    typedBridge.emit("hello");     
})

// TS Error:
// typedBridge.on((message: string) => {
//     typedBridge.emit(123);
// })
```

### Mirrored Stream Typing
When parent and child contexts have asymmetric contracts (e.g., Request $\rightarrow$ Response), pass both `<TIn, TOut>` and mirror them on the other side:

### shared-types.ts:
```ts
export type WorkerReq = { type: "SUM"; a: number; b: number };
export type WorkerRes = { type: "RESULT"; value: number };
```

### main.ts:
``` ts
const mainBridge = new Bridge<WorkerRes, WorkerReq>(workerTransport(worker));
mainBridge.emit({ type: "SUM", a: 5, b: 10 });
mainBridge.on((res) => console.log(res.value)); 
```

### worker.ts:
```ts
const workerBridge = new Bridge<WorkerReq, WorkerRes>(createWorker());
workerBridge.on((req) => {
  if (req.type === "SUM") {
    workerBridge.emit({ type: "RESULT", value: req.a + req.b });
  }
});
```

---

## API

### `new Bridge<TIn = any, TOut = TIn>(transport)`

Wraps a `Transport` in a small pub/sub interface.

| Method | Description |
| ----- | ----- |
| `on(listener: (data: TIn) => void)` | Subscribes to incoming messages. Returns an `unsubscribe` function. |
| `off(listener: (data: TIn) => void)` | Removes a specific listener. |
| `emit(payload: TOut)` | Sends a payload through the transport. |
| `destroy()` | Clears all listeners, unsubscribes from the transport, and calls `transport.terminate?.()`. Safe to call multiple times. |

Once `destroy()` has been called, `emit()` and `on()` become no-ops (they log a warning instead of throwing), so you don't have to guard every call site against a torn-down bridge.

### `Transport<T>` interface

Implement this to support any custom messaging channel:

```ts
export interface Transport<T = any> {
  send(data: T): void;
  onMessage(handler: (data: T) => void): () => void; // must return an unsubscribe fn
  terminate?(): void;
}
```

`onMessage` **must** return a function that detaches the handler — `Bridge` relies on this to release its internal references on `destroy()`. See [DEVELOPMENT.md](./DEVELOPMENT.md) for why this matters.

### Built-in transports

* `workerTransport<T>(worker: Worker): Transport<T>` — wraps a `Worker` instance (main thread side).
* `createWorker<T>(): Transport<T>` — auto create bridge to for `Worker` handling tasks.
* `messagePort<T>(iframe: HTMLIFrameElement): Transport<T>` — initiates a `MessageChannel` handshake with an iframe (parent side).
* `acceptMessagePort<T>(): Promise<Transport<T>>` — awaits and resolves the `MessageChannel` handshake (iframe side) __(needs async function)__.
* `broadcast<T>(channelName: string): Transport<T>` — wraps a `BroadcastChannel` for cross-tab/window communication.

## Cleaning up

Always call `destroy()` (or at least the `unsubscribe` returned by `on()`) when you're done with a `Bridge`, especially in UI frameworks that mount/unmount components repeatedly. Forgetting this is the single most common source of leaked listeners and orphaned workers running in the background.
