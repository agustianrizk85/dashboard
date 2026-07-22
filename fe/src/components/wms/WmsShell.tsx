import { Fragment, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { navIcon } from "./wmsNavIcons";
import "./wms.css";

export interface WmsNavItem {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  /** Optional unread/pending count shown as a pill on the right of the item. */
  badge?: number;
  /** Optional node at the right edge of the item (e.g. a collapse caret). */
  trailing?: ReactNode;
  /** Optional node rendered directly under the item (e.g. a collapsible submenu). */
  sub?: ReactNode;
}
export interface WmsNavGroup {
  heading?: string;
  items: WmsNavItem[];
}
export interface WmsTab {
  key: string;
  label: string;
}

/**
 * Greenpark "Ops Console" shell — the shared WMS-style frame (left sidebar +
 * top tabs + scrollable content) used by the redesigned per-division dashboards
 * (staff / kadep). Everything is scoped under `.wms` so it never leaks into the
 * CEO's old all-access views. Pass the module's own nav groups, overview tabs,
 * an optional toolbar (search/filters) and the content.
 */
export function WmsShell({
  brand,
  brandSub,
  nav,
  tabs,
  activeTab,
  onTab,
  toolbar,
  children,
}: {
  brand: string;
  brandSub?: string;
  nav: WmsNavGroup[];
  tabs?: WmsTab[];
  activeTab?: string;
  onTab?: (key: string) => void;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const initials = (user?.name || user?.username || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="wms">
      <aside className="wms-side">
        <div className="wms-brand">
          <img src="/brand/logo-mark.png" alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div className="wms-brand-t">
            <b>{brand}</b>
            <span>{brandSub ?? "Greenpark Group"}</span>
          </div>
        </div>

        {nav.map((group, gi) => (
          <div className="wms-navgroup" key={gi}>
            {group.heading && <div className="wms-navgroup-h">{group.heading}</div>}
            <div className="wms-nav">
              {group.items.map((it, ii) => (
                <Fragment key={ii}>
                  <button className={it.active ? "on" : ""} onClick={it.onClick} type="button">
                    <span className="ic">{it.icon ?? navIcon(it.label)}</span>
                    <span className="lbl">{it.label}</span>
                    {it.badge ? <span className="wms-nav-badge">{it.badge > 99 ? "99+" : it.badge}</span> : null}
                    {it.trailing}
                  </button>
                  {it.sub}
                </Fragment>
              ))}
            </div>
          </div>
        ))}

        <div className="wms-side-foot">
          <div className="wms-avatar">{initials}</div>
          <div className="who">
            <b>{user?.name || user?.username}</b>
            <span>{user?.email || user?.role}</span>
          </div>
          <button className="wms-logout" onClick={logout} title="Keluar" type="button">
            ⏻
          </button>
        </div>
      </aside>

      <div className="wms-main">
        {tabs && tabs.length > 0 && (
          <div className="wms-topbar-line">
            <div className="wms-topbar">
              <div className="wms-tabs">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    className={"wms-tab" + (t.key === activeTab ? " on" : "")}
                    onClick={() => onTab?.(t.key)}
                    type="button"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="wms-scroll">
          {toolbar && <div className="wms-toolbar">{toolbar}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
