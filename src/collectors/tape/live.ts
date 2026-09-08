import { ops } from "../../ops/log.js";
import { nextBackoffMs } from "./backoff.js";
import { fetchOpenInterest } from "./oi.js";
import { TapeRuntime, type PersistMark } from "./runtime.js";
import { parseStreamEnvelope, combinedStreamUrl } from "./stream.js";

export type SocketLike = {
  onopen?: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
};

export type SocketFactory = (url: string) => SocketLike;

export type LiveTape = {
  runtime: TapeRuntime;
  stop: () => void;
};

export function startLiveTape(opts?: {
  persistMark?: PersistMark;
  connect?: SocketFactory;
  url?: string;
  pollOiMs?: number;
  fetchOi?: () => Promise<import("./types.js").TapeTick[]>;
}): LiveTape {
  const runtime = new TapeRuntime(opts?.persistMark, opts?.fetchOi ?? fetchOpenInterest);
  const connect = opts?.connect ?? defaultConnect;
  const url = opts?.url ?? combinedStreamUrl();
  let stopped = false;
  let attempt = 0;
  let socket: SocketLike | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let oiTimer: ReturnType<typeof setInterval> | undefined;

  const open = () => {
    if (stopped) {
      return;
    }
    socket = connect(url);
    ops("tape", "ws.connect", `Opening Binance stream`, { data: { url, attempt } });
    socket.onopen = () => {
      ops("tape", "ws.open", "Binance websocket connected", { level: "ok" });
    };
    socket.onmessage = (event) => {
      attempt = 0;
      try {
        const tick = parseStreamEnvelope(event.data);
        if (tick) {
          runtime.ingest(tick);
        }
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      if (stopped) {
        return;
      }
      const wait = nextBackoffMs(attempt);
      attempt += 1;
      ops("tape", "ws.close", `Websocket closed; reconnect in ${wait}ms (attempt ${attempt})`, {
        level: "warn",
        data: { waitMs: wait, attempt },
      });
      reconnectTimer = setTimeout(open, wait);
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  open();
  void runtime.pollOi();
  oiTimer = setInterval(() => {
    void runtime.pollOi();
  }, opts?.pollOiMs ?? 60_000);

  return {
    runtime,
    stop() {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (oiTimer) {
        clearInterval(oiTimer);
      }
      socket?.close();
    },
  };
}

function defaultConnect(url: string): SocketLike {
  return new WebSocket(url) as SocketLike;
}
