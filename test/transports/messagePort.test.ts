import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acceptMessagePort, messagePort } from "../../src/transports/messagePort";
import {
  FakeIframe,
  FakeMessageChannel,
  FakeWindow,
  tick,
} from "../helpers/fakes";

class TrackedMessageChannel extends FakeMessageChannel {
  static instances: TrackedMessageChannel[] = [];

  constructor() {
    super();
    TrackedMessageChannel.instances.push(this);
  }
}

function createParent(contentWindow: FakeWindow | null = new FakeWindow()) {
  const iframe = new FakeIframe(contentWindow);
  const transport = messagePort<string>(iframe as unknown as HTMLIFrameElement);
  const channel = TrackedMessageChannel.instances[TrackedMessageChannel.instances.length - 1]!;

  return { iframe, transport, channel };
}

beforeEach(() => {
  TrackedMessageChannel.instances = [];
  vi.stubGlobal("MessageChannel", TrackedMessageChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("messagePort (parent side)", () => {
  it("performs the handshake lazily on the first send and only once", async () => {
    const window = new FakeWindow();
    const { transport, channel } = createParent(window);
    const received = vi.fn<(event: MessageEvent) => void>();
    channel.port2.onmessage = received;

    expect(window.postMessageCalls).toHaveLength(0);

    transport.send("first");
    transport.send("second");

    expect(window.postMessageCalls).toHaveLength(1);
    const handshake = window.postMessageCalls[0]!;
    expect(handshake.message).toEqual({ type: "__INIT_PORT__" });
    expect(handshake.targetOrigin).toBe("*");
    expect(handshake.transfer).toEqual([channel.port2]);

    await tick();
    expect(received.mock.calls.map(([event]) => event.data)).toEqual(["first", "second"]);
  });

  it("throws when the iframe content window is not accessible", () => {
    const { iframe, transport } = createParent(null);

    expect(() => transport.send("hello")).toThrow("iframe.contentWindow is not accessible");

    const window = new FakeWindow();
    iframe.contentWindow = window;

    transport.send("hello");
    expect(window.postMessageCalls).toHaveLength(1);
  });

  it("delivers messages arriving on the channel port", async () => {
    const { transport, channel } = createParent();
    const handler = vi.fn<(data: string) => void>();
    const unsubscribe = transport.onMessage(handler);

    channel.port2.postMessage("incoming");
    await tick();
    expect(handler).toHaveBeenCalledExactlyOnceWith("incoming");

    unsubscribe();
    channel.port2.postMessage("ignored");
    await tick();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not detach a newer handler when an older cleanup runs", async () => {
    const { transport, channel } = createParent();
    const first = vi.fn<(data: string) => void>();
    const second = vi.fn<(data: string) => void>();

    const unsubscribeFirst = transport.onMessage(first);
    const unsubscribeSecond = transport.onMessage(second);

    unsubscribeFirst();
    channel.port2.postMessage("hello");
    await tick();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith("hello");

    unsubscribeSecond();
    expect(channel.port1.onmessage).toBeNull();
  });

  it("closes the channel port on terminate", () => {
    const { transport, channel } = createParent();

    transport.terminate?.();

    expect(channel.port1.closed).toBe(true);
  });

  it("completes the handshake with acceptMessagePort and exchanges messages", async () => {
    const childWindow = new FakeWindow();
    vi.stubGlobal("window", childWindow);
    const { transport } = createParent(childWindow);
    const accepted = acceptMessagePort<string>();

    transport.send("from-parent");
    const childTransport = await accepted;

    const childHandler = vi.fn<(data: string) => void>();
    childTransport.onMessage(childHandler);
    await tick();
    expect(childHandler).toHaveBeenCalledExactlyOnceWith("from-parent");

    const parentHandler = vi.fn<(data: string) => void>();
    transport.onMessage(parentHandler);
    childTransport.send("from-child");
    await tick();
    expect(parentHandler).toHaveBeenCalledExactlyOnceWith("from-child");

    expect(childWindow.listenerCount).toBe(0);
  });
});

describe("acceptMessagePort (iframe side)", () => {
  let fakeWindow: FakeWindow;

  beforeEach(() => {
    fakeWindow = new FakeWindow();
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores unrelated messages and handshakes without a port", async () => {
    const channel = new FakeMessageChannel();
    const accepted = acceptMessagePort<string>();
    const onResolved = vi.fn();
    void accepted.then(onResolved);

    fakeWindow.dispatchMessage({ type: "OTHER" }, [channel.port2]);
    fakeWindow.dispatchMessage({ type: "__INIT_PORT__" });
    fakeWindow.dispatchMessage(null);
    fakeWindow.dispatchMessage("__INIT_PORT__");
    await tick();

    expect(onResolved).not.toHaveBeenCalled();
    expect(fakeWindow.listenerCount).toBe(1);

    fakeWindow.dispatchMessage({ type: "__INIT_PORT__" }, [channel.port2]);
    await tick();

    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(fakeWindow.listenerCount).toBe(0);
  });

  it("returns a transport wired to the transferred port", async () => {
    const channel = new FakeMessageChannel();
    const accepted = acceptMessagePort<number>();
    fakeWindow.dispatchMessage({ type: "__INIT_PORT__" }, [channel.port2]);
    const transport = await accepted;

    const first = vi.fn<(data: number) => void>();
    const second = vi.fn<(data: number) => void>();
    const unsubscribeFirst = transport.onMessage(first);
    const unsubscribeSecond = transport.onMessage(second);

    unsubscribeFirst();
    channel.port1.postMessage(1);
    await tick();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(1);

    unsubscribeSecond();
    channel.port1.postMessage(2);
    await tick();
    expect(second).toHaveBeenCalledTimes(1);

    const outgoing = vi.fn<(event: MessageEvent) => void>();
    channel.port1.onmessage = outgoing;
    transport.send(3);
    await tick();
    expect(outgoing).toHaveBeenCalledTimes(1);
    expect(outgoing.mock.calls[0]![0].data).toBe(3);

    transport.terminate?.();
    expect(channel.port2.closed).toBe(true);
  });
});
