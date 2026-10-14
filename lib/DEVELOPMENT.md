# Developing web-bridger

Notes for anyone maintaining this library, not just using it.

## Architecture

```text
src/
  transport.ts            Transport<T> interface (the contract every channel implements)
  bridge.ts               Bridge<TIn, TOut> — the pub/sub wrapper consumers actually use
  transports/
    messagePort.ts        Parent (`messagePort`) & child (`acceptMessagePort`) iframe MessageChannel handshake
    worker.ts             Main thread (`workerTransport`) & worker context (`createWorker`) transports
    broadcast.ts          Cross-tab transport backed by BroadcastChannel (`broadcast`)
  index.ts                Public entry point (barrel export)
```

The design is deliberately small: `Transport<T>` is the only extension point. To support a new channel (WebSocket, WebRTC DataChannel, Electron IPC, etc.), write a function that returns an object matching `Transport<T>` and it works with `Bridge` unmodified.

## Type System (`Bridge<TIn, TOut>`)

* `Bridge<TIn = any, TOut = TIn>` decouples incoming message types (`TIn`, passed to `.on()` listeners) from outgoing payload types (`TOut`, passed to `.emit()`).
* By defaulting `TOut = TIn`, consumers can pass a single generic (`new Bridge<MyMessage>(...)`) for symmetric channels, or two generics (`new Bridge<Res, Req>(...)`) for asymmetric request/response streams across contexts.
* Internally, `Bridge` holds a `Transport<TIn | TOut>` reference so the underlying transport remains agnostic to directionality while preserving strict external contracts.

## Memory-safety rules for this codebase

Keep these rules in mind for any future change:

1. **`onMessage` must return a real unsubscribe function, and callers must store and call it.**
   If `Bridge` calls `transport.onMessage(...)` and discards the return value:
   ```ts
   // don't do this
   this.transport.onMessage((message) => this.notifyListeners(message));
   ```
   The arrow function closes over `this`, so the transport's internal listener registry held a live reference to the `Bridge` instance for as long as the transport exists. If a given `Transport` implementation doesn't provide `terminate()`, there is no code path that releases that reference — the `Bridge`, its `listeners` `Set`, and everything inside those listeners' closures leak for the lifetime of the transport.

   `Bridge` stores the unsubscribe function and calls it unconditionally inside `destroy()`, independent of whether `terminate()` exists:
   ```ts
   this.unsubscribe = this.transport.onMessage((message) => this.notifyListeners(message as TIn));
   // ...
   destroy() {
     if (this.destroyed) return;
     this.destroyed = true;
     this.listeners.clear();
     this.unsubscribe();
     this.transport.terminate?.();
   }
   ```
   **When adding a new transport, `onMessage` must be implemented properly** — its returned function must actually detach the handler (`removeEventListener`, `port.onmessage = null`, etc.), or this cleanup mechanism does nothing.

2. **Unsubscribing and terminating are different operations — don't conflate them.**
   In `transports/messagePort.ts` (both `messagePort` and `acceptMessagePort`), `onMessage`'s unsubscribe function only detaches the handler (`port.onmessage = null`); closing the port (`port.close()`) is strictly `terminate()`'s job. Similarly, in `acceptMessagePort`, the global `window` handshake listener is immediately removed via `window.removeEventListener('message', handleHandshake)` as soon as `__INIT_PORT__` is captured.

3. **`destroy()` is idempotent and safe to call from multiple places.**
   A `destroyed` flag guards against double-cleanup (e.g. calling `close()` on an already-closed port or `BroadcastChannel`, or `terminate()` on an already-terminated worker) and turns post-destroy `emit()`/`on()` calls into console warnings instead of exceptions — useful when destroy order between a parent component and its children isn't guaranteed.

4. **`workerTransport` and `broadcast` are reference implementations.**
   Both use `addEventListener`/`removeEventListener` with a named handler reference and clean up their underlying browser primitives in `terminate()`. Use them as templates when writing a new transport.

## Build & publish

```bash
npm install        # installs tsup + typescript
npm run typecheck  
npm run build      # tsup -> dist/ (ESM + CJS + .d.ts)
npm pack --dry-run # sanity-check exactly what will be published
npm publish        # runs prepublishOnly (typecheck + build) automatically
```

## Adding a transport

1. Create `src/transports/<name>.ts` exporting a generic factory function `<T = any>(...): Transport<T>`.
2. Implement `onMessage` so its returned function truly detaches the listener (see the memory-safety rules above).
3. Implement `terminate` if the underlying channel has a close/dispose mechanism.
4. Re-export the factory from `src/index.ts`.
5. Add a short usage example to `README.md`.

### Example (how Broadcast transport looks like):
``` ts 
import { Transport } from "../transport";

export function broadcast<T>(channelName: string): Transport<T> {
    // 1. Initialize your underlying communication channel
    const bc = new BroadcastChannel(channelName);

    return {
        send(data: T) {
            // 2. Send data through the channel
            bc.postMessage(data);
        },
        
        onMessage(handler: (data: T) => void) {
            // 3. Wrap the callback to extract the actual payload from the event
            const listener = (event: MessageEvent) => {
                handler(event.data);
            };

            // 4. Subscribe to the channel's events
            bc.addEventListener('message', listener);
            
            // 5. IMPORTANT: Return a cleanup function to detach the listener
            return () => {
                bc.removeEventListener('message', listener);
            };
        },
        
        terminate() {
            // 6. Optionally clean up the channel itself
            bc.close();
        },
    };
}
```
