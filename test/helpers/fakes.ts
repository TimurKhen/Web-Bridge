import { vi } from "vitest";

import type { Transport } from "../../src/transport";

type MessageListener = (event: MessageEvent) => void;

/**
 * Minimal in-memory Transport used to test Bridge without touching DOM APIs.
 */
export function createFakeTransport<T = unknown>() {
  const handlers = new Set<(data: T) => void>();
  const send = vi.fn<(data: T) => void>();
  const terminate = vi.fn<() => void>();

  const transport: Transport<T> = {
    send,
    onMessage(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    terminate,
  };

  return {
    transport,
    send,
    terminate,
    handlerCount: () => handlers.size,
    receive(data: T) {
      for (const handler of [...handlers]) handler(data);
    },
  };
}

/**
 * Stand-in for a Worker in the main thread (workerTransport).
 */
export class FakeWorker {
  readonly messages: unknown[] = [];
  readonly listeners = new Set<MessageListener>();
  readonly terminate = vi.fn<() => void>();

  postMessage(data: unknown): void {
    this.messages.push(data);
  }

  addEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.delete(listener);
  }

  dispatchMessage(data: unknown): void {
    for (const listener of [...this.listeners]) {
      listener({ data } as unknown as MessageEvent);
    }
  }
}

/**
 * Stand-in for the worker global scope (createWorker).
 */
export class FakeWorkerGlobalScope extends FakeWorker {
  readonly close = vi.fn<() => void>();
}

/**
 * Stand-in for window: the event target that acceptMessagePort() listens on.
 * postMessage() delivers the message to this same window, like a parent page
 * posting into an iframe.
 */
export class FakeWindow {
  readonly postMessageCalls: Array<{
    message: unknown;
    targetOrigin: string;
    transfer: Transferable[];
  }> = [];

  private readonly listeners = new Set<MessageListener>();

  addEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage(message: unknown, targetOrigin = "*", transfer: Transferable[] = []): void {
    this.postMessageCalls.push({ message, targetOrigin, transfer });
    this.dispatchMessage(message, transfer);
  }

  dispatchMessage(data: unknown, ports: unknown[] = []): void {
    for (const listener of [...this.listeners]) {
      listener({ data, ports } as unknown as MessageEvent);
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

export class FakeIframe {
  contentWindow: FakeWindow | null;

  constructor(contentWindow: FakeWindow | null = new FakeWindow()) {
    this.contentWindow = contentWindow;
  }
}

/**
 * MessagePort look-alike that queues messages until onmessage is assigned,
 * matching the browser behavior the transports rely on.
 */
export class FakeMessagePort {
  closed = false;
  peer: FakeMessagePort | undefined;

  private handler: MessageListener | null = null;
  private readonly queue: unknown[] = [];

  get onmessage(): MessageListener | null {
    return this.handler;
  }

  set onmessage(listener: MessageListener | null) {
    this.handler = listener;
    this.flush();
  }

  postMessage(data: unknown): void {
    if (this.closed) return;

    const peer = this.peer;
    if (!peer) return;

    queueMicrotask(() => {
      if (peer.closed) return;
      if (peer.handler) {
        peer.handler({ data } as unknown as MessageEvent);
      } else {
        peer.queue.push(data);
      }
    });
  }

  close(): void {
    this.closed = true;
  }

  private flush(): void {
    if (!this.handler || this.queue.length === 0) return;

    const pending = this.queue.splice(0);
    for (const data of pending) {
      queueMicrotask(() => {
        if (this.closed) return;
        this.handler?.({ data } as unknown as MessageEvent);
      });
    }
  }
}

export class FakeMessageChannel {
  readonly port1 = new FakeMessagePort();
  readonly port2 = new FakeMessagePort();

  constructor() {
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
  }
}

const broadcastChannels = new Set<FakeBroadcastChannel>();

/**
 * Stand-in for BroadcastChannel. Messages are delivered to every other open
 * channel with the same name, asynchronously, and never back to the sender.
 */
export class FakeBroadcastChannel {
  closed = false;

  private readonly listeners = new Set<MessageListener>();

  constructor(readonly name: string) {
    broadcastChannels.add(this);
  }

  addEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MessageListener): void {
    if (type === "message") this.listeners.delete(listener);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;

    for (const channel of [...broadcastChannels]) {
      if (channel === this || channel.closed || channel.name !== this.name) continue;
      channel.enqueue(data);
    }
  }

  close(): void {
    this.closed = true;
    broadcastChannels.delete(this);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  private enqueue(data: unknown): void {
    queueMicrotask(() => {
      if (this.closed) return;
      for (const listener of [...this.listeners]) {
        listener({ data } as unknown as MessageEvent);
      }
    });
  }
}

export function openBroadcastChannels(): FakeBroadcastChannel[] {
  return [...broadcastChannels];
}

export function resetBroadcastChannels(): void {
  broadcastChannels.clear();
}

export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
