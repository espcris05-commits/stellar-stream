import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reconnects with 1s, 2s, 4s backoff", async () => {
    await act(async () => {
      renderHook(() => useWebSocket<{ type: string }>("ws://localhost/test"));
      await Promise.resolve();
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    await act(async () => {
      MockWebSocket.instances[0].close();
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    await act(async () => {
      MockWebSocket.instances[1].close();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    await act(async () => {
      MockWebSocket.instances[2].close();
    });
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it("calls onMessage handler for valid messages", async () => {
    const onMessage = vi.fn();
    let result: any;
    await act(async () => {
      const hook = renderHook(() =>
        useWebSocket<{ type: string; id: string }>("ws://localhost/test", {
          onMessage,
        }),
      );
      result = hook.result;
      await Promise.resolve();
    });

    const payload = { type: "stream_update", id: "123" };
    await act(async () => {
      MockWebSocket.instances[0].emitMessage(payload);
    });

    expect(onMessage).toHaveBeenCalledWith(payload);
    expect(result.current.lastMessage).toEqual(payload);
  });

  it("silently ignores malformed or unknown message types", async () => {
    const onMessage = vi.fn();
    let result: any;
    await act(async () => {
      const hook = renderHook(() =>
        useWebSocket<{ type: string }>("ws://localhost/test", { onMessage }),
      );
      result = hook.result;
      await Promise.resolve();
    });

    await act(async () => {
      // Malformed JSON should be caught by the try-catch in the hook
      MockWebSocket.instances[0].onmessage?.({
        data: "invalid json",
      } as MessageEvent<string>);
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(result.current.lastMessage).toBeNull();
  });

  it("closes WebSocket cleanly on unmount", async () => {
    let unmount: () => void;
    await act(async () => {
      const hook = renderHook(() =>
        useWebSocket<{ type: string }>("ws://localhost/test"),
      );
      unmount = hook.unmount;
      await Promise.resolve();
    });
    const socket = MockWebSocket.instances[0];
    const closeSpy = vi.spyOn(socket, "close");

    await act(async () => {
      unmount();
    });

    expect(closeSpy).toHaveBeenCalled();
  });
});
