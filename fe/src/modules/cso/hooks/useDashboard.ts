import { useCallback, useEffect, useState } from "react";
import { useRealtimeSocket } from "@/lib/realtime";
import { api } from "../api/client";
import type { Dashboard } from "../types";

type State =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: Dashboard; error: null }
  | { status: "error"; data: null; error: string };

/** Fetch the derived CSO dashboard, refetching live on every backend push. */
export function useDashboard(): [State, () => void] {
  const [state, setState] = useState<State>({ status: "loading", data: null, error: null });

  const load = useCallback(() => {
    api
      .dashboard()
      .then((d) => setState({ status: "ready", data: d, error: null }))
      .catch((err: unknown) => {
        setState({ status: "error", data: null, error: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(load, [load]);
  useRealtimeSocket(api.realtimeURL(), load);

  return [state, load];
}
