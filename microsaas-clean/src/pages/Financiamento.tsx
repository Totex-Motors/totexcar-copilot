import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Banknote, Plus, Trash2, CheckCircle2, ScanLine, CalendarClock } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { toast } from "@/hooks/use-toast";
import {
  useFinancings, useCreateFinancing, useUpdateFinancing, useDeleteFinancing,
  financingStatus, type Financiamento,
} from "@/hooks/useFinancing";
import { decodeBoleto } from "@/utils/boleto";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");
const emptyForm = { banco: "", valor_parcela: "", num_parcelas: "", parcelas_pagas: "0", primeira_parcela: "", valor_total: "", valor_entrada: "", boleto_linha: "" };

// TELA FINANCIAMENTO — cadastra o financiamento e acompanha as parcelas (lê boleto). Padrão Minha Garagem.
export default function Financiamento() {
  const { userId, userData, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: financings } = useFinancings(userId);
  const create = useCreateFinancing();
  const update = useUpdateFinancing();
  const del = useDeleteFinancing();

  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const lerBoleto = () => {
    const { valor, vencimento } = decodeBoleto(form.boleto_linha);
    if (!valor && !vencimento) { toast({ title: "Não reconheci o boleto", description: "Confira a linha digitável (47 dígitos) ou preencha manualmente.", variant: "destructive" }); return; }
    setForm((p) => ({ ...p, valor_parcela: valor ? String(valor.toFixed(2)) : p.valor_parcela, primeira_parcela: vencimento || p.primeira_parcela }));
    toast({ title: "Boleto lido! 🧾", description: `${valor ? brl(valor) : "valor —"} · vence ${vencimento ? new Date(vencimento).toLocaleDateString("pt-BR") : "—"}. Confira e complete.` });
  };

  const handleAdd = () => {
    const valor_parcela = Number(form.valor_parcela);
    const num_parcelas = Number(form.num_parcelas);
    if (!valor_parcela || !num_parcelas || !form.primeira_parcela) { toast({ title: "Preencha valor da parcela, nº de parcelas e a data da 1ª parcela", variant: "destructive" }); return; }
    create.mutate(
      { user_id: userId!, account_id: vehicle?.id ?? null, banco: form.banco.trim() || null, valor_parcela, num_parcelas, parcelas_pagas: Number(form.parcelas_pagas) || 0, primeira_parcela: form.primeira_parcela, valor_total: form.valor_total ? Number(form.valor_total) : null, valor_entrada: form.valor_entrada ? Number(form.valor_entrada) : null, boleto_linha: form.boleto_linha.replace(/\D/g, "") || null } as any,
      { onSuccess: () => { toast({ title: "Financiamento cadastrado" }); setForm(emptyForm); setOpen(false); }, onError: (e: any) => toast({ title: "Erro", description: String(e?.message || e), variant: "destructive" }) },
    );
  };

  const pagarParcela = (f: Financiamento) => {
    if (f.parcelas_pagas >= f.num_parcelas) return;
    update.mutate({ id: f.id, parcelas_pagas: f.parcelas_pagas + 1 }, { onSuccess: () => toast({ title: "Parcela registrada", description: `${f.parcelas_pagas + 1}/${f.num_parcelas} pagas` }) });
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const list = financings || [];
  const inp = (k: keyof typeof form, ph: string, type = "text") => (
    <input className="field" type={type} inputMode={type === "number" ? "decimal" : undefined} value={form[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph} />
  );

  return (
    <MgShell title="Financiamento" back="/">
      <div className="stack">
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 2px", lineHeight: 1.4 }}>Cadastre o financiamento do carro e acompanhe as parcelas. Em breve, alertas no WhatsApp antes de cada vencimento.</p>

        {/* lista */}
        {list.length ? (
          <section className="card" style={{ padding: 4 }}>
            {list.map((f) => {
              const stt = financingStatus(f);
              const pct = Math.max(2, Math.min(100, (f.parcelas_pagas / f.num_parcelas) * 100));
              const venceProx = stt.dias != null && stt.dias <= 5 && stt.dias >= 0;
              const atrasada = stt.dias != null && stt.dias < 0;
              const cor = stt.quitado ? "var(--good)" : atrasada ? "var(--alert)" : venceProx ? "var(--warn)" : "var(--brand)";
              return (
                <div key={f.id} style={{ padding: "13px 12px", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        {f.banco || "Financiamento"}
                        {stt.quitado ? <span className="tag ok">Quitado</span> : atrasada ? <span className="tag" style={{ background: "var(--alert-soft)", color: "var(--alert)" }}>Atrasada</span> : venceProx ? <span className="tag due">Vence em {stt.dias}d</span> : null}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                        {f.parcelas_pagas}/{f.num_parcelas} · {brl(f.valor_parcela)}/mês{!stt.quitado && <> · próxima <b style={{ color: "var(--ink)" }}><CalendarClock size={11} style={{ display: "inline", verticalAlign: -1 }} /> {fmtDate(stt.proximaData)}</b></>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flex: "none" }}>
                      {!stt.quitado && <button className="sbtn" onClick={() => pagarParcela(f)} disabled={update.isPending}><CheckCircle2 size={14} /> Paguei</button>}
                      <button className="sbtn" style={{ color: "var(--alert)", padding: "8px 9px" }} onClick={() => del.mutate(f.id)} aria-label="Excluir"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "var(--card-2)", overflow: "hidden", marginTop: 9 }}><div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 999 }} /></div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 5 }}>{stt.quitado ? "Pago integralmente 🎉" : `Faltam ${stt.restantes} parcelas · saldo ${brl(stt.saldoDevedor)}`}</div>
                </div>
              );
            })}
          </section>
        ) : (
          <div className="card pad" style={{ textAlign: "center" }}>
            <Banknote size={34} style={{ opacity: .4, margin: "6px auto", color: "var(--brand)" }} />
            <div style={{ fontWeight: 700 }}>Nenhum financiamento ainda</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Cadastre o seu (ou cole a linha digitável do boleto) pra acompanhar as parcelas.</p>
          </div>
        )}

        {/* novo */}
        {open ? (
          <section className="card pad">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Novo financiamento</div>
            <div style={{ borderRadius: 12, border: "1px solid var(--brand-soft)", background: "var(--brand-soft)", padding: 12, marginBottom: 14 }}>
              <label className="lbl" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--brand)" }}><ScanLine size={14} /> Tem o boleto? Cole a linha digitável</label>
              {inp("boleto_linha", "00000.00000 00000.000000 ...")}
              <button className="sbtn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={lerBoleto}><ScanLine size={14} /> Ler valor e vencimento</button>
            </div>
            <label className="lbl">Banco / financeira</label>
            {inp("banco", "Banco BV, Santander...")}
            <div className="formgrid" style={{ marginTop: 12 }}>
              <div><label className="lbl">Valor da parcela</label>{inp("valor_parcela", "980.00", "number")}</div>
              <div><label className="lbl">Nº de parcelas</label>{inp("num_parcelas", "48", "number")}</div>
              <div><label className="lbl">Parcelas já pagas</label>{inp("parcelas_pagas", "0", "number")}</div>
              <div><label className="lbl">1ª parcela (data)</label>{inp("primeira_parcela", "", "date")}</div>
              <div><label className="lbl">Valor total (opc.)</label>{inp("valor_total", "47000.00", "number")}</div>
              <div><label className="lbl">Entrada (opc.)</label>{inp("valor_entrada", "10000.00", "number")}</div>
            </div>
            <button className="btn-primary" style={{ marginTop: 14 }} onClick={handleAdd} disabled={create.isPending}><Plus size={16} /> {create.isPending ? "Salvando..." : "Cadastrar financiamento"}</button>
          </section>
        ) : (
          <button className="card list-row" onClick={() => setOpen(true)} style={{ width: "100%", cursor: "pointer", textAlign: "left" }}>
            <span className="offer-ico"><Plus size={19} /></span>
            <div style={{ flex: 1 }}><div className="t">Novo financiamento</div><div className="s">Cadastre manual ou colando o boleto</div></div>
          </button>
        )}

        <p className="foot-note">Marque "Paguei" a cada parcela — o saldo devedor e a próxima data se atualizam sozinhos.</p>
      </div>
    </MgShell>
  );
}
