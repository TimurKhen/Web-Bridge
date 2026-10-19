import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { broadcast } from "../../src/transports/broadcast";
import {
  FakeBroadcastChannel,
  openBroadcastChannels,
  resetBroadcastChannels,
  tick,
} from "../helpers/fakes";

beforeEach(() => {
  resetBroadcastChannels();
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("broadcast", () => {
  it("opens a BroadcastChannel with the requested name", () => {
    broadcast("app-sync");
    broadcast("other");

    expect(openBroadcastChannels().map((channel) => channel.name)).toEqual([
      "app-sync",
      "other",
    ]);
  });

  it("delivers messages to other channels with the same name", async () => {
    const sender = broadcast<string>("app-sync");
    const receiver = broadcast<string>("app-sync");
    const received = vi.fn<(data: string) => void>();

    receiver.onMessage(received);
    sender.send("hello");
    await tick();

    expect(received).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("does not echo messages back to the sending channel", async () => {
    const sender = broadcast<string>("app-sync");
    const receiver = broadcast<string>("app-sync");
    const echo = vi.fn<(data: string) => void>();

    sender.onMessage(echo);
    receiver.onMessage(() => {});
    sender.send("hello");
    await tick();

    expect(echo).not.toHaveBeenCalled();
  });

  it("isolates channels with different names", async () => {
    const sender = broadcast<string>("channel-a");
    const receiver = broadcast<string>("channel-b");
    const received = vi.fn<(data: string) => void>();

    receiver.onMessage(received);
    sender.send("hello");
    await tick();

    expect(received).not.toHaveBeenCalled();
  });

  it("delivers a message to every handler on the channel", async () => {
    const sender = broadcast<string>("app-sync");
    const receiver = broadcast<string>("app-sync");
    const first = vi.fn<(data: string) => void>();
    const second = vi.fn<(data: string) => void>();

    receiver.onMessage(first);
    receiver.onMessage(second);
    sender.send("hello");
    await tick();

    expect(first).toHaveBeenCalledExactlyOnceWith("hello");
    expect(second).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("stops delivering messages after unsubscribe", async () => {
    const sender = broadcast<string>("app-sync");
    const receiver = broadcast<string>("app-sync");
    const received = vi.fn<(data: string) => void>();

    const unsubscribe = receiver.onMessage(received);
    unsubscribe();
    sender.send("hello");
    await tick();

    expect(received).not.toHaveBeenCalled();
    const receiverChannel = openBroadcastChannels()[1] as FakeBroadcastChannel;
    expect(receiverChannel.listenerCount).toBe(0);
  });

  it("closes the underlying channel and stops delivery on terminate", async () => {
    const sender = broadcast<string>("app-sync");
    const receiver = broadcast<string>("app-sync");
    const received = vi.fn<(data: string) => void>();

    receiver.onMessage(received);
    const receiverChannel = openBroadcastChannels()[1] as FakeBroadcastChannel;
    receiver.terminate?.();

    expect(receiverChannel.closed).toBe(true);

    sender.send("hello");
    await tick();
    expect(received).not.toHaveBeenCalled();
  });
});
