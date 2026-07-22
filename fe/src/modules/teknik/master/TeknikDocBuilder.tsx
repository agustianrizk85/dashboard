import { useEffect, useState } from "react";
import { DocBuilder, type DocFillSource } from "@/components/klausul/DocBuilder";
import { api } from "../api/client";
import type { Unit, Proyek } from "../types";

/** DocBuilder khusus Teknik: menyuplai auto-isi Unit/Proyek dari data teknik-be
 *  (mengisi {NAMA PROYEK}/{TIPE UNIT}/{BLOK}/{LB} dari unit terpilih). DocBuilder
 *  sendiri tetap generik. */
export function TeknikDocBuilder() {
  const [sources, setSources] = useState<DocFillSource[]>([]);

  useEffect(() => {
    Promise.all([api.list<Unit>("units"), api.list<Proyek>("proyek")])
      .then(([units, proyek]) => {
        const byId = new Map(proyek.map((p) => [p.id, p]));
        const options = units
          .map((u) => {
            const proyekNama = byId.get(u.proyekId)?.nama ?? "";
            return {
              id: u.id,
              label: `${proyekNama || "—"} · ${u.blok}${u.type ? ` (${u.type})` : ""}`,
              values: {
                "NAMA PROYEK": proyekNama,
                "TIPE UNIT": u.type ?? "",
                TIPE: u.type ?? "",
                "BLOK UNIT": u.blok ?? "",
                BLOK: u.blok ?? "",
                LB: u.luasBangunan != null ? String(u.luasBangunan) : "",
                LT: u.luasTanah != null ? String(u.luasTanah) : "",
              },
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
        setSources([
          {
            label: "🏠 Isi dari Unit / Proyek",
            placeholder: "— pilih unit (auto-isi proyek/tipe/blok) —",
            options,
          },
        ]);
      })
      .catch(() => setSources([]));
  }, []);

  return <DocBuilder division="teknik" fillSources={sources} />;
}
