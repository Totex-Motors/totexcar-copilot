import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageCircle, FileText, Copy, Download, CalendarClock, CheckCircle2, X, ChevronRight, Loader2, Search, Sparkles,
} from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { useMultas, useUpdateMultaStatus, type Multa } from "@/hooks/useMultas";
import { runGptConsulta, startGptCheckout, fetchUltimaConsulta, type GptResult } from "@/hooks/useGptMotors";
import { toast } from "@/hooks/use-toast";

const WA = "5511963786699";
const WA_LINK = `https://wa.me/${WA}?text=${encodeURIComponent("Oi! Recebi uma multa e quero analisar. Vou mandar a foto do auto de infração 📄")}`;
const brl = (v: number | null) => v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

const STATUS: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "due" }, recurso_gerado: { label: "Recurso pronto", cls: "new" },
  protocolada: { label: "Protocolada", cls: "blue" }, deferida: { label: "Deferida 🎉", cls: "ok" }, indeferida: { label: "Indeferida", cls: "mut" },
};
const CHANCE: Record<string, { label: string; cls: string }> = {
  alta: { label: "Chance alta", cls: "ok" }, media: { label: "Chance média", cls: "due" }, baixa: { label: "Chance baixa", cls: "mut" },
};
const diasRestantes = (prazo: string | null) => prazo ? Math.ceil((new Date(prazo + "T23:59:59").getTime() - Date.now()) / 86400000) : null;
const fmtData = (d: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const PRECO_DEBITOS = 19.9; // preço de exibição (valor final vem do servidor)

export default function Multas() {
  const { userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: multas, isLoading } = useMultas(userId);
  const updateStatus = useUpdateMultaStatus();
  const [aberta, setAberta] = useState<Multa | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GptResult | null>(null);
  const [params, setParams] = useSearchParams();

  const placa = vehicle?.placa || "";

  useEffect(() => {
    if (params.get("status") !== "success" || !userId) return;
    setBusy(true);
    let tries = 0;
    const tick = async () => {
      const r = await fetchUltimaConsulta(userId, "debitos", placa || undefined);
      if (r) { setRes(r); setBusy(false); setParams({}, { replace: true }); return; }
      if (++tries >= 10) { setBusy(false); setParams({}, { replace: true }); return; }
      setTimeout(tick, 3000);
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, userId, placa]);
  const waDebitos = `https://wa.me/${WA}?text=${encodeURIComponent(`Quero consultar os débitos do meu carro${placa ? ` (placa ${placa})` : ""} 💸`)}`;
  const consultarDebitos = async () => {
    if (!placa || busy) return;
    setBusy(true); setRes(null);
    const r = await runGptConsulta("debitos", placa);
    setRes(r); setBusy(false);
  };
  const est = res?.ok ? res.dados?.estadual : null;
  const ren = res?.ok ? res.dados?.renainf : null;
  const debEst: any[] = Array.isArray(est?.debitosEstaduais) ? est.debitosEstaduais : [];

  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ title: "Recurso copiado!", description: "Cole no site/formulário do órgão autuador." }); } catch { toast({ title: "Não consegui copiar", variant: "destructive" }); } };
  const baixar = (m: Multa) => { const b = new Blob([m.recurso_texto || ""], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `recurso-multa-${m.auto_numero || m.id.slice(0, 8)}.txt`; a.click(); URL.revokeObjectURL(a.href); };

  const lista = multas || [];
  const abertas = lista.filter((m) => !["deferida", "indeferida"].includes(m.status));
  const totalAberto = abertas.reduce((s, m) => s + (Number(m.valor) || 0), 0);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;

  return (
    <MgShell title="Multas & Débitos" back="/">
      <div className="stack">
        {/* CTA WhatsApp */}
        <a className="copilot" href={WA_LINK} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Recebeu uma multa?</div>
            <div className="s">Manda a foto do auto de infração no WhatsApp — em segundos vem a análise + o recurso pronto.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        {/* resumo */}
        {!!lista.length && (
          <div className="kpi">
            <div className="box"><div className="l">Multas abertas</div><div className="v">{abertas.length}</div></div>
            <div className="box"><div className="l">Valor em aberto</div><div className="v mono" style={{ color: "var(--gain)" }}>{brl(totalAberto)}</div></div>
          </div>
        )}

        {/* consulta de débitos ao vivo (GPT Motors) */}
        {res?.ok && (
          <section className="card pad">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="badge-p" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Sparkles size={12} /> Débitos atualizados</span>
              {res.cached && <span className="tag mut">recente</span>}
            </div>
            {est?.restricoesImpedimentos?.situacaoVeiculo && (
              <div style={{ fontSize: 13.5, marginBottom: 8 }}>Situação: <b>{est.restricoesImpedimentos.situacaoVeiculo}</b></div>
            )}
            {debEst.length > 0 ? (
              <div className="stack" style={{ gap: 8 }}>
                {debEst.map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, borderTop: i ? "1px solid var(--line)" : "none", paddingTop: i ? 8 : 0 }}>
                    <span style={{ color: "var(--muted)" }}>{d.nome || d.chave || "Débito"}</span><span style={{ fontWeight: 700 }}>{d.valor || "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--good)" }}>Nenhum débito estadual encontrado. ✅</div>
            )}
            {ren?.resumo && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                Multas federais (Renainf): <b style={{ color: "var(--ink)" }}>{ren.resumo.quantidadeOcorrencias ?? ren.resumo.quantidadeOcorrenciasTotal ?? 0}</b>{ren.resumo.alerta ? ` · ${ren.resumo.alerta}` : ""}
              </div>
            )}
            {res.analiseIA && <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{res.analiseIA}</p>}
          </section>
        )}
        {res && !res.ok && res.needsPayment && (
          <section className="card pad" style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Débitos atualizados por {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO_DEBITOS}`}</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 12px" }}>IPVA, licenciamento e multas (estadual + federal), na hora. Pague no Pix ou cartão.</p>
            <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); const r = await startGptCheckout("debitos", placa); if (!r.ok) { setBusy(false); alert("Não consegui abrir o pagamento: " + (r.error || "")); } }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Pagar {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO_DEBITOS.toFixed(2).replace(".", ",")}`}
            </button>
            <a style={{ display: "block", marginTop: 10, fontSize: 12.5, color: "var(--muted)" }} href={waDebitos} target="_blank" rel="noreferrer">ou consultar pelo Co-pilot no WhatsApp</a>
          </section>
        )}
        {res && !res.ok && !res.needsPayment && (
          <div className="card pad" style={{ background: "var(--gain-soft)", borderColor: "transparent", fontSize: 13 }}>
            <b>Não consegui consultar agora.</b> {res.error || "Tente de novo em instantes."}
          </div>
        )}
        {placa && (
          <button className="btn-primary" onClick={consultarDebitos} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            {busy ? "Consultando…" : res?.ok ? "Consultar de novo" : `Consultar débitos · R$ ${PRECO_DEBITOS.toFixed(2).replace(".", ",")}`}
          </button>
        )}

        {/* lista */}
        {isLoading ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Carregando...</div>
        ) : !lista.length ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>
            <FileText size={34} style={{ opacity: .4, margin: "6px auto" }} />
            <div style={{ fontSize: 14 }}>Nenhuma multa registrada. Tomara que continue assim! 🍀</div>
          </div>
        ) : (
          lista.map((m) => {
            const dias = diasRestantes(m.prazo_recurso);
            const st = STATUS[m.status] || STATUS.nova;
            const ch = m.chance ? CHANCE[m.chance] : null;
            const urgente = dias != null && dias >= 0 && dias <= 5;
            return (
              <section key={m.id} className="card pad">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.25 }}>{m.descricao || "Multa"}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>Valor: <b style={{ color: "var(--ink)" }}>{brl(m.valor)}</b>{m.auto_numero ? ` · Auto ${m.auto_numero}` : ""}</div>
                  </div>
                  <span className={`tag ${st.cls}`} style={{ alignSelf: "flex-start" }}>{st.label}</span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {ch && <span className={`tag ${ch.cls}`}>{ch.label}</span>}
                  {m.prazo_recurso && (
                    <span className={`tag ${urgente ? "due" : "mut"}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CalendarClock size={12} /> {dias != null && dias >= 0 ? `${dias}d p/ recorrer` : `prazo ${fmtData(m.prazo_recurso)}`}
                    </span>
                  )}
                </div>

                {(m.recurso_texto || m.status === "recurso_gerado") && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {m.recurso_texto && <button className="sbtn brand" onClick={() => setAberta(m)}><FileText size={14} /> Ver recurso</button>}
                    {m.status === "recurso_gerado" && <button className="sbtn" onClick={() => updateStatus.mutate({ id: m.id, status: "protocolada" })}><CheckCircle2 size={14} /> Já protocolei</button>}
                  </div>
                )}
              </section>
            );
          })
        )}

        <p className="foot-note">⚖️ O recurso é um modelo gerado por IA com base no que você informou. A decisão é do órgão autuador — protocole dentro do prazo.</p>
      </div>

      {/* bottom sheet do recurso */}
      {aberta && (
        <div className="overlay" onClick={() => setAberta(null)}>
          <div className="sheet2" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} style={{ color: "var(--brand)" }} /> Recurso</div>
              <button className="icon-btn" onClick={() => setAberta(null)}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Revise, copie e protocole no órgão autuador (site, JARI ou presencial) dentro do prazo.</div>
            <div className="card pad" style={{ background: "var(--card-2)" }}><pre>{aberta.recurso_texto}</pre></div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="sbtn brand" style={{ flex: 1, justifyContent: "center" }} onClick={() => aberta.recurso_texto && copiar(aberta.recurso_texto)}><Copy size={14} /> Copiar</button>
              <button className="sbtn" style={{ flex: 1, justifyContent: "center" }} onClick={() => baixar(aberta)}><Download size={14} /> Baixar</button>
            </div>
          </div>
        </div>
      )}
    </MgShell>
  );
}
