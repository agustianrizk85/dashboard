import { useCallback, useEffect, useState } from "react";
import type { Dashboard } from "./controltower/types";
import { api, AuthError } from "./controltower/api/client";
import { Admin } from "./controltower/components/admin/Admin";

const SALES_SVC = { user: "admin", pass: "admin123" };

/**
 * Sales "Master Data" tab — the ported standalone Admin (Upload Excel +
 * Google-Sheets sync + editable master tables). It loads the sales dashboard
 * payload and re-fetches after every write so the Control Tower reflects edits.
 */
export function AdminView() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const fetchOnce = async () => {
      if (!api.hasToken()) await api.login(SALES_SVC.user, SALES_SVC.pass);
      return api.dashboard();
    };
    try {
      setData(await fetchOnce());
      setError("");
    } catch (e) {
      if (e instanceof AuthError) {
        try {
          await api.login(SALES_SVC.user, SALES_SVC.pass);
          setData(await api.dashboard());
          setError("");
          return;
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : String(e2));
          return;
        }
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="ct-scope embed">
        <div className="splash error">
          <div className="splash-title">Gagal memuat data</div>
          <div className="splash-msg">{error}</div>
          <button className="splash-btn" onClick={() => void load()}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="ct-scope embed">
        <div className="splash">
          <div className="spinner" />
          Memuat data sales…
        </div>
      </div>
    );
  }
  return (
    <div className="ct-scope embed">
      <div className="gp-root">
        <Admin data={data} reload={load} />
      </div>
    </div>
  );
}
