import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { DivisionTabs } from "./DivisionTabs";

/**
 * Unified two-tier tab bar used by every division dashboard.
 *
 * - All-access directors: the cross-division switcher (DivisionTabs) renders on
 *   top, and this module's own tabs (children) on a SECOND row, indented to start
 *   exactly under the active division tab — so the sub-tabs clearly belong to the
 *   division you're in.
 * - Regular single-division users: just the module tabs on one row.
 *
 * Modules pass their tab `<button className="tab">`s as children. `navClass` is
 * the module's existing tab-bar class (default "tabs").
 */
export function DivisionTabBar({ children, navClass = "tabs" }: { children: ReactNode; navClass?: string }) {
  const { user } = useAuth();
  const allAccess = !!user?.allAccess;
  const divNavRef = useRef<HTMLElement>(null);
  const [subPad, setSubPad] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!allAccess) return;
    const measure = () => {
      const nav = divNavRef.current;
      const el = nav?.querySelector<HTMLElement>(".divtab.on");
      if (nav && el) {
        // Offset of the active division tab from the nav's own left edge — the
        // sub-tab row shares that edge, so this padding aligns them exactly.
        setSubPad(Math.max(0, el.getBoundingClientRect().left - nav.getBoundingClientRect().left));
      }
    };
    measure();
    const t = window.setTimeout(measure, 250); // re-measure after web fonts settle
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [allAccess]);

  if (!allAccess) {
    return <nav className={navClass}>{children}</nav>;
  }
  return (
    <>
      <nav className={navClass} ref={divNavRef}>
        <DivisionTabs />
      </nav>
      <nav className={`${navClass} subtabs`} style={subPad != null ? { paddingLeft: subPad } : undefined}>
        {children}
      </nav>
    </>
  );
}
