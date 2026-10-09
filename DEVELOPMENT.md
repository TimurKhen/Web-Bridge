# Developing transport-contract

Notes for anyone maintaining this library, not just using it.

## Architecture

```
src/
  transport.ts            Transport interface (the contract every channel implements)
  contract.ts              Contract — the pub/sub wrapper consumers actually use
  transports/
    messagePort.ts         Transport backed by an iframe MessageChannel handshake
    worker.ts               Transport backed by a Worker
  index.ts                 Public entry point (barrel export)
```

The design is deliberately small: `Transport` is the only extension point. To support a new channel (BroadcastChannel, a WebSocket, a native bridge, etc.), write a function that returns an object matching `Transport` and it works with `Contract` unmodified.

## Memory-safety rules for this codebase

These were the actual bugs fixed when this package was set up for publishing — keep them in mind for any future change:

1. **`onMessage` must return a real unsubscribe function, and callers must store and call it.**
   The original `Contract` constructor called `transport.onMessage(...)` and discarded the return value:

   ```ts
   // don't do this
   this.transport.onMessage((message) => this.notifyListeners(message));
   ```

   The arrow function closes over `this`, so the transport's internal listener registry held a live reference to the `Contract` instance for as long as the transport existed. If a given `Transport` implementation didn't provide `terminate()` (it's optional), there was no code path that ever released that reference — the `Contract`, its `listeners` `Set`, and everything inside those listeners' closures would leak for the lifetime of the transport.

   Fix: `Contract` now stores the unsubscribe function and calls it unconditionally inside `destroy()`, independent of whether `terminate()` exists:

   ```ts
   this.unsubscribe = this.transport.onMessage((message) => this.notifyListeners(message));
   // ...
   destroy() {
     this.listeners.clear();
     this.unsubscribe();
     this.transport.terminate?.();
   }
   ```

   **When adding a new transport, `onMessage` is not optional to implement correctly** — its returned function must actually detach the handler (`removeEventListener`, `port.onmessage = null`, clearing a map entry, etc.), or this whole mechanism does nothing.

2. **Unsubscribing and terminating are different operations — don't conflate them.**
   `transports/messagePort.ts` used to close the `MessagePort` from inside `onMessage`'s returned unsubscribe function. That meant "stop listening" and "destroy the channel" were the same action, so a caller couldn't swap a listener without also tearing down the port. `onMessage`'s unsubscribe now only detaches the handler (`port.onmessage = null`); closing the port is `terminate()`'s job alone.

3. **`destroy()` is idempotent and safe to call from multiple places.**
   A `destroyed` flag guards against double-cleanup (e.g. calling `close()` on an already-closed port, or `terminate()` on an already-terminated worker) and turns post-destroy `emit()`/`on()` calls into warnings instead of exceptions — useful when destroy order between a component and its children isn't guaranteed.

4. **`workerTransport` was already correct** — it uses `addEventListener`/`removeEventListener` with a named handler reference, so no change was needed there. Use it as the reference implementation when writing a new transport.

## What was intentionally left out of the package

`pipes/pipe-example.ts` from the original source was **not** carried into `src/`. It was never exported from the entry point, had no callers anywhere in the codebase, and worked by monkey-patching `Contract.prototype` at module-load time via `declare module` + `Contract.prototype.pipe = ...`. Shipping that in a published package means simply *importing* the module — even without calling anything in it — mutates every `Contract` instance in the consuming app's process. If a real "pipe" feature is needed later, it should be a plain exported function (`pipe(contract, ...)`) rather than a global prototype patch, so importing it has no side effects.

## Build & publish

```bash
npm install        # installs tsup + typescript
npm run typecheck  # tsc --noEmit — also catches unused imports/locals (noUnusedLocals/noUnusedParameters are on)
npm run build      # tsup -> dist/ (ESM + CJS + .d.ts)
npm pack --dry-run # sanity-check exactly what will be published
npm publish        # runs prepublishOnly (typecheck + build) automatically
```

Before your first real publish:
- `package.json`'s `name` is currently the placeholder `transport-contract` — check it's available on the registry (or scope it, e.g. `@yourorg/transport-contract`) and update `name` accordingly.
- Fill in `repository`, `author`, and `homepage` fields once the repo has a home.
- Confirm the `MIT` license is actually the one you want; add a `LICENSE` file to match.
- Bump `version` following semver — this scaffold starts at `0.1.0`.

## Adding a transport

1. Create `src/transports/<name>.ts` exporting a factory function that returns a `Transport`.
2. Implement `onMessage` so its returned function truly detaches the listener (see the memory-safety rules above).
3. Re-export the factory from `src/index.ts`.
4. Add a short usage example to `README.md`.
