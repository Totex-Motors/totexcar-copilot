import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Wrench, Plus, Trash2, CheckCircle2, Gauge, AlertTriangle, MessageCircle, ChevronRight } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { toast } from "@/hooks/use-toast";
import {
  useMaintenance, useCreateMaintenance, useMarkMaintenanceDone, useDeleteMaintenance,
  maintenanceStatus,
} from "@/hooks/useMaintenance";

const WA = "5511963786699";
const kmFmt = (n: number) => `${Number(n || 0).toLocaleString("pt-BR")} km`;

const PRESETS: { title: string; interval: number }[] = [
  { title: "Troca de óleo", interval: 10000 },
  { title: "Filtro de óleo", interval: 10000 },
  { title: "Filtro de ar", interval: 20000 },
  { title: "Rodízio de pneus", interval: 10000 },
  { title: "Alinhamento", interval: 10000 },
  { title: "Pastilhas de freio", interval: 30000 },
  { title: "Correia dentada", interval: 50000 },
  { title: "Velas", interval: 40000 },
  { title: "Revisão geral", interval: 10000 },
];

const LEVEL: Record<string, { label: string; color: string; soft: string }> = {
  overdue: { label: "Vencida", color: "var(--alert)", soft: "var(--alert-soft)" },
  soon: { label: "Próxima", color: "var(--warn)", soft: "var(--gain-soft)" },
  ok: { label: "Em dia", color: "var(--good)", soft: "var(--good-soft)" },
};

// TELA MANUTENÇÃO POR KM — revisões projetadas pelo hodômetro (troca de óleo, freios, correia...).
// Mesma lógica de sempre (criar/feito/apagar + presets), agora no padrão Minha Garagem.
export default function Manutencao() {
  const { userId, userData, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: reminders } = useMaintenance(userId);
  const create = useCreateMaintenance();
  const markDone = useMarkMaintenanceDone();
  const del = useDeleteMaintenance();

  const currentKm = Number(vehicle?.hodometro || 0);
  const [form, setForm] = useState({ title: "", interval: "", last: "" });
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    const list = [...(reminders || [])];
    return list.sort((a, b) => maintenanceStatus(a, currentKm).remaining - maintenanceStatus(b, currentKm).remaining);
  }, [reminders, currentKm]);

  const handleAdd = () => {
    const interval = Number(form.interval);
    if (!form.title.trim() || !interval) { toast({ title: "Preencha o item e o intervalo (km)", variant: "destructive" }); return; }
    if (!vehicle) { toast({ title: "Cadastre seu veículo primeiro", variant: "destructive" }); return; }
    const last = form.last === "" ? currentKm : Number(form.last);
    create.mutate(
      { user_id: userId!, account_id: vehicle.id, title: form.title.trim(), interval_km: interval, last_km: last },
      {
        onSuccess: () => { toast({ title: "Lembrete criado" }); setForm({ title: "", interval: "", last: "" }); setOpen(false); },
        onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }),
      },
    );
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  return (
    <MgShell title="Manutenção por km" back="/">
      <div className="stack">
        {/* hodômetro */}
        <div className="kpi">
          <div className="box" style={{ flex: 1 }}>
            <div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Gauge size={12} /> Hodômetro atual</div>
            <div className="v mono">{currentKm ? kmFmt(currentKm) : "—"}</div>
            {!currentKm && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Registre um gasto com o km ou edite em Meu veículo.</div>}
          </div>
        </div>

        {/* lista */}
        {sorted.length ? (
          <section className="card" style={{ padding: 4 }}>
            {sorted.map((r) => {
              const st = maintenanceStatus(r, currentKm);
              const lv = LEVEL[st.level];
              const pct = Math.max(2, Math.min(100, ((r.interval_km - st.remaining) / r.interval_km) * 100));
              return (
                <div key={r.id} style={{ padding: "13px 12px", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                        {st.level === "overdue" && <AlertTriangle size={14} style={{ color: "var(--alert)", flex: "none" }} />}
                        {r.title}
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "2px 7px", borderRadius: 6, background: lv.soft, color: lv.color }}>{lv.label}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                        A cada {kmFmt(r.interval_km)} · próxima em <b style={{ color: "var(--ink)" }}>{kmFmt(st.next)}</b>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flex: "none" }}>
                      <button className="sbtn" onClick={() => markDone.mutate({ id: r.id, last_km: currentKm }, { onSuccess: () => toast({ title: "Marcado como feito", description: `${r.title} em ${kmFmt(currentKm)}` }) })} disabled={markDone.isPending}>
                        <CheckCircle2 size={14} /> Feito
                      </button>
                      <button className="sbtn" aria-label="Apagar" onClick={() => del.mutate(r.id)} style={{ color: "var(--alert)", padding: "8px 9px" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {/* barra de progresso */}
                  <div style={{ height: 7, borderRadius: 999, background: "var(--card-2)", overflow: "hidden", marginTop: 9 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: lv.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 5 }}>
                    {st.remaining > 0 ? `Faltam ${kmFmt(st.remaining)}` : `Passou ${kmFmt(Math.abs(st.remaining))} do previsto`}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <div className="card pad" style={{ textAlign: "center" }}>
            <Wrench size={34} style={{ opacity: .4, margin: "6px auto", color: "var(--brand)" }} />
            <div style={{ fontWeight: 700 }}>Nenhum lembrete ainda</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Adicione "Troca de óleo a cada 10.000 km" pra eu avisar na hora certa, pelo km rodado.</p>
          </div>
        )}

        {/* novo lembrete */}
        {open ? (
          <section className="card pad">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Novo lembrete</div>
            <label className="lbl">Item</label>
            <input className="field" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex.: Troca de óleo" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "9px 0 2px" }}>
              {PRESETS.map((pr) => (
                <button key={pr.title} type="button" onClick={() => setForm((p) => ({ ...p, title: pr.title, interval: String(pr.interval) }))}
                  style={{ fontSize: 11.5, borderRadius: 999, border: "1px solid var(--line)", background: form.title === pr.title ? "var(--brand-soft)" : "var(--card)", color: form.title === pr.title ? "var(--brand)" : "var(--muted)", padding: "5px 10px", cursor: "pointer" }}>
                  {pr.title}
                </button>
              ))}
            </div>
            <div className="formgrid" style={{ marginTop: 12 }}>
              <div><label className="lbl">A cada (km)</label><input className="field" type="number" inputMode="numeric" value={form.interval} onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value }))} placeholder="10000" /></div>
              <div><label className="lbl">Km da última troca</label><input className="field" type="number" inputMode="numeric" value={form.last} onChange={(e) => setForm((p) => ({ ...p, last: e.target.value }))} placeholder={currentKm ? String(currentKm) : "atual"} /></div>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 2px 14px" }}>Se deixar a última vazia, uso o hodômetro atual ({kmFmt(currentKm)}).</p>
            <button className="btn-primary" onClick={handleAdd} disabled={create.isPending}><Plus size={16} /> {create.isPending ? "Criando..." : "Adicionar lembrete"}</button>
          </section>
        ) : (
          <button className="card list-row" onClick={() => setOpen(true)} style={{ width: "100%", background: "var(--card)", cursor: "pointer", textAlign: "left" }}>
            <span className="offer-ico"><Plus size={19} /></span>
            <div style={{ flex: 1 }}><div className="t">Novo lembrete</div><div className="s">Troca de óleo, freios, correia...</div></div>
            <ChevronRight size={20} style={{ color: "var(--faint)" }} />
          </button>
        )}

        {/* co-pilot */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero registrar uma manutenção do carro 🔧")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Registrar no WhatsApp</div>
            <div className="s">Fez a revisão? Manda pro Co-pilot com o km — ele atualiza os lembretes sozinho.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <p className="foot-note">Os lembretes usam o km do hodômetro — quanto mais você registra, mais certeiros eles ficam.</p>
      </div>
    </MgShell>
  );
}
