import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useRealtimeSocket } from "@/lib/realtime";
import { api, AuthError } from "../controltower/api/client";
import { parseDigits } from "./credit";
import { assessConsumerAI } from "./ai";
import { QuestionManager } from "./QuestionManager";
import { Button, BoolToggle, Card, CurrencyInput, EmptyState, Field, Select, TextArea, TextInput } from "./ui";
import { VERDICT_META, type ScreeningAnswer, type ScreeningQuestion, type ScreeningSubmission } from "./types";
import "./staff.css";

export default function ScreeningView() {
  const { user } = useAuth();
  const canManage = !!user && (user.role === "kadep" || !!user.super || (!!user.allAccess && !!user.canApprove));

  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [submissions, setSubmissions] = useState<ScreeningSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [managing, setManaging] = useState(false);

  // form state
  const [consumer, setConsumer] = useState("");
  const [phone, setPhone] = useState("");
  const [project, setProject] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [assessing, setAssessing] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [result, setResult] = useState<ScreeningSubmission | null>(null);

  const activeQuestions = useMemo(
    () => questions.filter((q) => q.active).sort((a, b) => a.order - b.order),
    [questions],
  );

  const reload = useCallback(async () => {
    try {
      const [qs, subs] = await Promise.all([api.screeningQuestions(), api.screeningSubmissions()]);
      setQuestions(qs ?? []);
      setSubmissions(subs ?? []);
      setLoadErr("");
    } catch (e) {
      if (!(e instanceof AuthError)) setLoadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  useRealtimeSocket(api.realtimeURL(), () => void reload());

  const setAnswer = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  const resetForm = () => {
    setConsumer("");
    setPhone("");
    setProject("");
    setUnit("");
    setPrice(0);
    setAnswers({});
    setFormErr("");
    setResult(null);
  };

  const assess = async () => {
    if (!consumer.trim()) {
      setFormErr("Nama konsumen wajib diisi.");
      return;
    }
    const missing = activeQuestions.find((q) => q.required && !(answers[q._id] ?? "").trim());
    if (missing) {
      setFormErr(`Pertanyaan wajib belum diisi: "${missing.label}"`);
      return;
    }
    const payload: ScreeningAnswer[] = activeQuestions.map((q) => ({
      questionId: q._id,
      label: q.label,
      value: (answers[q._id] ?? "").trim(),
    }));
    setAssessing(true);
    setFormErr("");
    try {
      // Score via the CENTRAL auth AI gateway (Ollama); null → backend rules.
      const aiResult = await assessConsumerAI({
        consumer: consumer.trim(),
        project: project.trim(),
        unit: unit.trim(),
        price: price || undefined,
        answers: payload,
      });
      const saved = await api.assessScreening({
        consumer: consumer.trim(),
        phone: phone.trim(),
        project: project.trim(),
        unit: unit.trim(),
        price: price || undefined,
        answers: payload,
        result: aiResult,
      });
      setResult(saved);
      setSubmissions((s) => [saved, ...s.filter((x) => x._id !== saved._id)]);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAssessing(false);
    }
  };

  const del = async (id: string) => {
    try {
      await api.deleteScreening(id);
      setSubmissions((s) => s.filter((x) => x._id !== id));
      if (result?._id === id) setResult(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <div className="sales-staff">
        <EmptyState icon="⏳" message="Memuat screening…" />
      </div>
    );
  }

  // A failed load (server down / feature not deployed) → friendly, actionable.
  if (loadErr && questions.length === 0) {
    return (
      <div className="sales-staff">
        <Header canManage={false} onManage={() => {}} />
        <Card>
          <EmptyState
            icon="🔌"
            title="Belum bisa memuat screening"
            message="Data screening tidak bisa diambil dari server sales. Pastikan layanan sales aktif & sudah diperbarui, lalu coba lagi."
            action={<Button variant="ghost" onClick={() => void reload()}>Coba lagi</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="sales-staff">
      <Header canManage={canManage && !managing} onManage={() => setManaging(true)} />

      {managing ? (
        <QuestionManager
          questions={questions}
          onSaved={(qs) => {
            setQuestions(qs);
            setManaging(false);
          }}
          onClose={() => setManaging(false)}
        />
      ) : (
        <div className="st-grid">
          {/* ---- answer form ---- */}
          <Card title="Data Konsumen">
            <Field label="Nama konsumen" required>
              <TextInput value={consumer} onChange={setConsumer} placeholder="Nama lengkap calon pembeli" />
            </Field>
            <div className="st-qm-inline">
              <Field label="No. HP" className="st-grow">
                <TextInput value={phone} onChange={setPhone} placeholder="08xxxxxxxxxx" type="tel" />
              </Field>
              <Field label="Proyek" className="st-grow">
                <TextInput value={project} onChange={setProject} placeholder="Nama proyek / cluster" />
              </Field>
            </div>
            <div className="st-qm-inline">
              <Field label="Unit / kavling" className="st-grow">
                <TextInput value={unit} onChange={setUnit} placeholder="Blok / no. unit" />
              </Field>
              <Field label="Harga rumah" className="st-grow">
                <CurrencyInput value={price} onChange={setPrice} placeholder="500.000.000" />
              </Field>
            </div>

            {activeQuestions.length === 0 ? (
              <EmptyState
                icon="📝"
                title="Belum ada pertanyaan screening"
                message={canManage ? "Buat daftar pertanyaan yang harus diisi staff sebelum menilai konsumen." : "Kepala departemen belum menyiapkan pertanyaan screening."}
                action={canManage ? <Button onClick={() => setManaging(true)}>+ Buat Pertanyaan</Button> : undefined}
              />
            ) : (
              activeQuestions.map((q, i) => (
                <div key={q._id}>
                  {q.category && (i === 0 || activeQuestions[i - 1].category !== q.category) && (
                    <div className="st-cat">{q.category}</div>
                  )}
                  <QuestionField q={q} value={answers[q._id] ?? ""} onChange={(v) => setAnswer(q._id, v)} />
                </div>
              ))
            )}

            {formErr && <div className="st-msg err" style={{ marginTop: 6 }}>{formErr}</div>}
            <div className="st-actions">
              <Button onClick={assess} loading={assessing} disabled={activeQuestions.length === 0}>
                {assessing ? "Menilai…" : "🤖 Nilai Kelayakan"}
              </Button>
              <Button variant="ghost" onClick={resetForm} disabled={assessing}>
                Reset
              </Button>
            </div>
          </Card>

          {/* ---- result + history ---- */}
          <div>
            <Card title="Hasil Penilaian">
              <ResultCard sub={result} />
            </Card>

            <Card
              title={`Screening Terakhir${canManage ? " (semua staff)" : ""}`}
              right={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>{submissions.length}</span>}
            >
              {submissions.length === 0 ? (
                <EmptyState icon="🗂️" message="Belum ada screening tersimpan." />
              ) : (
                <div className="st-subs">
                  {submissions.slice(0, 12).map((s) => {
                    const v = VERDICT_META[s.result?.verdict ?? "review"];
                    return (
                      <div className="st-sub" key={s._id} onClick={() => setResult(s)}>
                        <div className="st-sub-badge" style={{ background: v.bg, color: v.c }}>
                          {s.result?.score ?? "–"}
                        </div>
                        <div className="st-sub-main">
                          <div className="n">{s.consumer}</div>
                          <div className="m">
                            {new Date(s.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            {canManage && s.byName ? ` · ${s.byName}` : ""}
                            {s.project ? ` · ${s.project}` : ""}
                          </div>
                        </div>
                        <div className="st-sub-v" style={{ color: v.c }}>{v.label}</div>
                        {canManage && (
                          <button
                            className="st-icon-btn"
                            title="Hapus"
                            onClick={(e) => {
                              e.stopPropagation();
                              void del(s._id);
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- header ---------- */
function Header({ canManage, onManage }: { canManage: boolean; onManage: () => void }) {
  return (
    <div className="st-head" style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <h2>Screening Konsumen</h2>
        <p>
          Isi jawaban konsumen, lalu AI menilai kelayakannya membeli rumah — layak, layak dengan syarat, atau belum layak —
          lengkap dengan alasan dan rekomendasi tindak lanjut.
        </p>
      </div>
      {canManage && (
        <Button variant="ghost" onClick={onManage}>
          ⚙ Kelola Pertanyaan
        </Button>
      )}
    </div>
  );
}

/* ---------- one dynamic answer field ---------- */
function QuestionField({ q, value, onChange }: { q: ScreeningQuestion; value: string; onChange: (v: string) => void }) {
  const control =
    q.type === "textarea" ? (
      <TextArea value={value} onChange={onChange} />
    ) : q.type === "boolean" ? (
      <BoolToggle value={value} onChange={onChange} />
    ) : q.type === "select" ? (
      <Select value={value} onChange={onChange} options={q.options ?? []} placeholder="— pilih —" />
    ) : q.type === "currency" ? (
      <CurrencyInput value={Number(parseDigits(value))} onChange={(n) => onChange(String(n))} placeholder="0" />
    ) : q.type === "number" ? (
      <TextInput value={value} onChange={(v) => onChange(v.replace(/[^\d.,]/g, ""))} placeholder="0" />
    ) : (
      <TextInput value={value} onChange={onChange} />
    );
  return (
    <Field label={q.label} required={q.required} hint={q.hint}>
      {control}
    </Field>
  );
}

/* ---------- verdict / result card ---------- */
function ResultCard({ sub }: { sub: ScreeningSubmission | null }) {
  if (!sub) {
    return <EmptyState icon="🤖" message='Isi form lalu klik "Nilai Kelayakan". Hasil penilaian AI akan tampil di sini.' />;
  }
  const r = sub.result;
  const v = VERDICT_META[r.verdict ?? "review"];
  return (
    <>
      <div className="st-verdict" style={{ background: v.bg }}>
        <div className="st-score" style={{ color: v.c }}>
          <b>{r.score}</b>
          <span>/ 100</span>
        </div>
        <div className="st-verdict-txt" style={{ color: v.c }}>
          <div className="vl">{v.label}</div>
          <div className="vs">{sub.consumer}</div>
        </div>
        <span className={`st-source ${r.source}`}>{r.source === "ai" ? "AI" : "Aturan"}</span>
      </div>

      {r.summary && <p className="st-summary">{r.summary}</p>}
      {r.note && <div className="st-note">{r.note}</div>}

      <div className="st-lists">
        {!!(r.strengths && r.strengths.length) && (
          <div className="st-list good">
            <h4>✓ Faktor Pendukung</h4>
            <ul>{r.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {!!(r.risks && r.risks.length) && (
          <div className="st-list risk">
            <h4>▲ Faktor Risiko</h4>
            <ul>{r.risks.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {!!(r.recommendations && r.recommendations.length) && (
          <div className="st-list rec">
            <h4>➜ Rekomendasi Tindak Lanjut</h4>
            <ul>{r.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
      </div>
    </>
  );
}
