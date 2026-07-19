import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { StaffMember } from "../types";
import { registerPicNames } from "./format";

/**
 * usePicRoster — loads the department roster from the backend (which syncs it
 * from the central auth SSO) and registers the username→name map so picName()
 * shows real names everywhere. Returns the full roster; callers filter by
 * `isPic` for PIC pickers. Refetches whenever `rev` changes (realtime bump).
 */
export function usePicRoster(rev?: number): StaffMember[] {
  const [roster, setRoster] = useState<StaffMember[]>([]);
  useEffect(() => {
    let alive = true;
    api
      .staff()
      .then((s) => {
        if (!alive) return;
        setRoster(s);
        registerPicNames(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rev]);
  return roster;
}

/** PIC-eligible members (design authors) from a roster. */
export function picsOf(roster: StaffMember[]): StaffMember[] {
  return roster.filter((r) => r.isPic);
}
