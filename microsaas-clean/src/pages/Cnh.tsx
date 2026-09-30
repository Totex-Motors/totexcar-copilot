import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronRight, MessageCircle, ShieldAlert, Pencil, Info, Loader2, Sparkles, IdCard } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { runGptConsulta, startGptCheckout, fetchUltimaConsulta, fetchConsultaById, useMinhasConsultas, type GptResult } from "@/hooks/useGptMotors";

const WA = "5511963786699";
const PRECO_CNH = 9.9;
const maskCpf = (v: string) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d); t.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}
const fmtBR = (d?: string | null) => { if (!d) return null; const [y, m, day] = String(d).split("-"); return day && m && y ? `${day}/${m}/${y}` : String(d); };

// TELA CNH — habilitação: vencimento (status real), consulta de pontos (via Co-pilot), regra de
// renovação e atalho pra multas. Dado hoje: cnh_vencimento (no cadastro do dono).
export default function Cnh() {
  const { userData, userId, loading } = useCurrentUser();
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GptResult | null>(null);
  const [params, setParams] = useSearchParams();
  const { data: consultasCnh } = useMinhasConsultas(userId, "cnh");

  useEffect(() => {
    if (params.get("status") !== "success" || !userId) return;
    setBusy(true);
    let tries = 0;
    const tick = async () => {
      const r = await fetchUltimaConsulta(userId, "cnh");
      if (r) { setRes(r); setBusy(false); setParams({}, { replace: true }); return; }
      if (++tries >= 10) { setBusy(false); setParams({}, { replace: true }); return; }
      setTimeout(tick, 3000);
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, userId]);

  const cpfLimpo = cpf.replace(/\D/g, "");
  const consultar = async () => {
    if (cpfLimpo.length !== 11 || busy) return;
    setBusy(true); setRes(null);
    const r = await runGptConsulta("cnh", cpfLimpo);
    setRes(r); setBusy(false);
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const venc = userData?.cnh_vencimento || null;
  const d = daysUntil(venc);
  const st = venc == null ? null
    : d! < 0 ? { txt: "Vencida", cls: "due", cor: "var(--alert)" }
    : d! <= 30 ? { txt: `Vence em ${d} dia(s)`, cls: "due", cor: "var(--gain)" }
    : { txt: "Em dia", cls: "ok", cor: "var(--good)" };

  return (
    <MgShell tab="cnh">
      <div className="stack">
        <div className="sec-title" style={{ fontSize: 20, marginTop: 2 }}>Minha CNH</div>

        {/* cartão da habilitação */}
        <section className="hero" style={{ background: "linear-gradient(150deg,#0C6E6A,#0A5350)" }}>
          <div className="eyebrow">Habilitação</div>
          {venc ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{st!.txt}</div>
              <span className="trend" style={{ marginTop: 8 }}><CalendarDays size={13} /> Vence {fmtBR(venc)}</span>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>Cadastre o vencimento</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 6 }}>Informe quando sua CNH vence pra eu te avisar antes.</p>
            </>
          )}
          <div className="hero-foot">
            <span className="updated">{userData?.name || "Motorista"}</span>
            <Link to="/settings" className="hero-cta">{venc ? "Editar" : "Informar"} <ChevronRight size={13} /></Link>
          </div>
        </section>

        {/* consultar pontos/situação (GPT Motors, por CPF) */}
        <section className="card pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><ShieldAlert size={16} style={{ color: "var(--brand)" }} /> Pontos e situação da CNH</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Consulta oficial por CPF: pontos, situação e validade.</p>

          {res?.ok ? (
            <div style={{ marginBottom: 8 }}>
              <span className="badge-p" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 8 }}><Sparkles size={12} /> Resultado{res.cached ? " (recente)" : ""}</span>
              {res.analiseIA
                ? <p style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{res.analiseIA}</p>
                : <p style={{ fontSize: 13, color: "var(--muted)" }}>Consulta concluída. Veja os detalhes com o Co-pilot.</p>}
            </div>
          ) : res && !res.ok && res.needsPayment ? (
            <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Consulta por {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO_CNH.toFixed(2).replace(".", ",")}`}</div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 10px" }}>Pague no Pix ou cartão e o resultado aparece aqui.</p>
              <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); const r = await startGptCheckout("cnh", cpfLimpo); if (!r.ok) { setBusy(false); alert("Não consegui abrir o pagamento: " + (r.error || "")); } }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Pagar {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO_CNH.toFixed(2).replace(".", ",")}`}
              </button>
            </div>
          ) : res && !res.ok ? (
            <div className="card pad" style={{ background: "var(--gain-soft)", borderColor: "transparent", fontSize: 13, marginBottom: 8 }}>
              <b>Não consegui consultar.</b> {res.error === "cpf_invalido" ? "Confira o CPF (11 dígitos)." : (res.error || "Tente de novo em instantes.")}
            </div>
          ) : null}

          {!res?.ok && (
            <>
              <input className="field" inputMode="numeric" placeholder="CPF do motorista" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
              <button className="btn-primary" style={{ marginTop: 10 }} onClick={consultar} disabled={busy || cpfLimpo.length !== 11}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                {busy ? "Consultando…" : `Consultar pontos · R$ ${PRECO_CNH.toFixed(2).replace(".", ",")}`}
              </button>
            </>
          )}
          {res?.ok && <button className="sbtn" style={{ marginTop: 10 }} onClick={() => { setRes(null); setCpf(""); }}>Nova consulta</button>}
        </section>

        {/* histórico de consultas de CNH */}
        {consultasCnh && consultasCnh.length > 0 && (
          <div>
            <div className="eyebrow" style={{ margin: "2px 2px 8px" }}>Minhas consultas de CNH</div>
            <section className="card">
              {consultasCnh.map((l: any) => (
                <button key={l.id} className="list-row" style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
                  onClick={async () => { const r = await fetchConsultaById(l.id); if (r) { setRes(r); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>
                  <span className="offer-ico"><IdCard size={18} /></span>
                  <div style={{ flex: 1 }}><div className="t">CPF ••••{String(l.cpf || "").slice(-4)}</div><div className="s">{new Date(l.created_at).toLocaleDateString("pt-BR")}</div></div>
                  <span className="tag ok" style={{ alignSelf: "center" }}>Rever</span>
                </button>
              ))}
            </section>
          </div>
        )}

        {/* multas */}
        <Link to="/multas" className="card list-row">
          <span className="offer-ico"><ShieldAlert size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Multas e recursos</div><div className="s">O que pode virar ponto</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        {/* renovação */}
        <section className="card pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14 }}><Info size={17} style={{ color: "var(--brand)" }} /> Quando renovar</div>
          <div style={{ marginTop: 8 }} className="stack">
            {[
              ["Até 49 anos", "a cada 10 anos"],
              ["50 a 69 anos", "a cada 5 anos"],
              ["70 anos ou mais", "a cada 3 anos"],
            ].map(([a, b]) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 8 }}>
                <span style={{ color: "var(--muted)" }}>{a}</span><b>{b}</b>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Regra geral do Contran. O exame toxicológico vale pra CNH C, D e E.</p>
        </section>

        {/* co-pilot */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Tenho dúvida sobre a minha CNH")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Dúvida sobre a CNH?</div>
            <div className="s">"Quando renovo?" · "Como faço o toxicológico?" — pergunta no WhatsApp.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <Link to="/settings"><button className="btn-primary"><Pencil size={17} /> Editar dados da CNH</button></Link>
        <p className="foot-note">Te aviso antes de vencer, se você informar a data. Documento sempre com você no ArquivoZap.</p>
      </div>
    </MgShell>
  );
}
