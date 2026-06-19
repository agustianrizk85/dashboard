import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Realtime layer for the unified dashboard.
 *
 * Each backend exposes a WebSocket at `<api>/ws?token=…` that pushes a small
 * `{ rev }` message every time its data changes (any write, by any user). The
 * frontend keeps one socket per module; on each push it bumps a monotonic
 * `rev` counter exposed through context. Components make their data "live" by:
 *
 *   - adding `rev` (via `useRev()`) to the dependency array of their data
 *     `reload` effect, or
 *   - remounting a view subtree with `key={rev}` so its loaders re-run.
 *
 * The socket auto-reconnects with a capped backoff, so a backend restart or a
 * dropped LAN connection self-heals without a page refresh.
 */
const RevContext = createContext(0);

/** Current realtime revision — increments on every backend data change. */
export function useRev(): number {
  return useContext(RevContext);
}

/**
 * Maintains one auto-reconnecting WebSocket to `url` and calls `onPush` on every
 * message. Reusable on its own (e.g. the embedded Sales Control Tower reads a
 * different backend than its host module) or via {@link RealtimeProvider}.
 */
export function useRealtimeSocket(url: string | null, onPush: () => void) {
  // Keep the latest url + handler in refs so reconnects pick up a fresh token
  // and callback without tearing the socket down on every render.
  const urlRef = useRef(url);
  urlRef.current = url;
  const pushRef = useRef(onPush);
  pushRef.current = onPush;

  useEffect(() => {
    if (!url) return;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const schedule = () => {
      const delay = Math.min(1000 * 2 ** retry, 15000); // 1s → 15s cap
      retry += 1;
      timer = setTimeout(connect, delay);
    };

    const connect = () => {
      const target = urlRef.current;
      if (closed || !target) return;
      try {
        ws = new WebSocket(target);
      } catch {
        schedule();
        return;
      }
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = () => {
        // Any push means "data changed" — let the subscriber refetch.
        pushRef.current();
      };
      ws.onclose = () => {
        if (!closed) schedule();
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
    // Re-establish only when auth state flips between "have url" and "no url".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!url]);
}

export function RealtimeProvider({
  url,
  children,
}: {
  /** Absolute ws/wss URL incl. ?token=, or null when not authenticated. */
  url: string | null;
  children: ReactNode;
}) {
  const [rev, setRev] = useState(0);
  useRealtimeSocket(url, () => setRev((r) => r + 1));
  return <RevContext.Provider value={rev}>{children}</RevContext.Provider>;
}
