import { useState, useEffect, useRef } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronRight, MessageCircle, ShieldAlert, Pencil, Info, Loader2, Sparkles, IdCard } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { runGptConsulta, startGptCheckout, fetchUltimaConsulta, fetchConsultaById, useMinhasConsultas, gptErroMsg, type GptResult } from "@/hooks/useGptMotors";

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
// "12/03/2031" (formato do Detran) → "2031-03-12"
const brToIso = (d?: string | null) => { const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const nomeCurto = (n?: string | null) => { const p = String(n || "").trim().split(/\s+/).filter(Boolean); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : p.join(" "); };
const titulo = (n: string) => n.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// Lê o retorno da consulta de CNH (GPT Motors / Detran) no formato do cartão.
// Pontos: o Detran não manda um total pronto — somamos o campo de pontos das ocorrências quando vier;
// sem ocorrências, mostramos "nenhuma ocorrência" (nunca um 0 inventado).
function lerCnh(dados: any) {
  const c = dados?.cnh || {};
  const oc: any[] = Array.isArray(dados?.ocorrencias) ? dados.ocorrencias : [];
  const pts = oc.reduce((t, o) => t + (Number(o?.pontos ?? o?.pontuacao ?? o?.quantidadePontos) || 0), 0);
  return {
    nome: dados?.dadosPessoais?.nome ? titulo(nomeCurto(dados.dadosPessoais.nome)) : null,
    categoria: c.categoriaAtual || c.categoriaAutorizada || null,
    registro: c.numeroRegistro ? `••••••${String(c.numeroRegistro).slice(-4)}` : null,
    validade: c.dataValidade || null,
    validadeIso: brToIso(c.dataValidade),
    primeira: c.dataPrimeiraHabilitacao || null,
    situacao: c.situacaoAtual || null,
    ocorrencias: oc.length,
    pontos: oc.length ? pts : null,
  };
}

// TELA CNH — habilitação: vencimento (status real), consulta de pontos (via Co-pilot), regra de
// renovação e atalho pra multas. Dado hoje: cnh_vencimento (no cadastro do dono).
export default function Cnh() {
  const { userData, userId, loading } = useCurrentUser();
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GptResult | null>(null);
  const [params, setParams] = useSearchParams();
  const { data: consultasCnh } = useMinhasConsultas(userId, "cnh");
  // última consulta paga → cartão desbloqueado (fica preenchido até a próxima consulta)
  const [ultima, setUltima] = useState<GptResult | null>(null);
  const consultaRef = useRef<HTMLDivElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (userId) fetchUltimaConsulta(userId, "cnh").then((r) => r && setUltima(r)); }, [userId]);
  useEffect(() => { if (res?.ok) setUltima(res); }, [res]);
  const cartao = ultima?.ok ? lerCnh(ultima.dados) : null;
  // validade oficial preenche o vencimento (os avisos de renovação passam a funcionar sozinhos)
  useEffect(() => {
    if (!userId || !cartao?.validadeIso || userData?.cnh_vencimento === cartao.validadeIso) return;
    supabase.from("users").update({ cnh_vencimento: cartao.validadeIso, ...(cartao.categoria ? { cnh_categoria: cartao.categoria } : {}) }).eq("id", userId).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cartao?.validadeIso]);
  const irParaConsulta = () => {
    consultaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => cpfRef.current?.focus(), 400);
  };

  useEffect(() => {
    if (params.get("status") !== "success" || !userId) return;
    setBusy(true);
    let tries = 0;
    const tick = async () => {
      const r = await fetchUltimaConsulta(userId, "cnh");
      if (r) { setRes(r); setBusy(false); setParams({}, { replace: true }); return; }
      if (++tries >= 25) { setBusy(false); setParams({}, { replace: true }); return; }
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

  const venc = cartao?.validadeIso || userData?.cnh_vencimento || null;
  const d = daysUntil(venc);
  const st = venc == null ? null
    : d! < 0 ? { txt: "Vencida", cls: "due", cor: "var(--alert)" }
    : d! <= 30 ? { txt: `Vence em ${d} dia(s)`, cls: "due", cor: "var(--gain)" }
    : { txt: "Em dia", cls: "ok", cor: "var(--good)" };

  return (
    <MgShell tab="cnh">
      <div className="stack">
        <div className="sec-title" style={{ fontSize: 20, marginTop: 2 }}>Minha CNH</div>

        {/* cartão da habilitação: bloqueado até a consulta paga; depois fica preenchido */}
        <section className="doc-card">
          <div className="dh">
            <div style={{ minWidth: 0 }}><div className="dl">Habilitação</div><div className="dn">{cartao?.nome || nomeCurto(userData?.name) || "Motorista"}</div></div>
            <div className={`dcat ${cartao ? "" : "blur"}`}><b>{cartao?.categoria || "AB"}</b><small>CATEGORIA</small></div>
          </div>
          <div className={`dg ${cartao ? "" : "blur"}`}>
            <div><span className="dl">Nº de registro</span><b>{cartao ? (cartao.registro || "—") : "••••••0000"}</b></div>
            <div><span className="dl">Validade</span><b>{cartao ? (cartao.validade || "—") : "00/00/0000"}</b></div>
            <div><span className="dl">1ª habilitação</span><b>{cartao ? (cartao.primeira || "—") : "00/00/0000"}</b></div>
            <div><span className="dl">Situação</span><b>{cartao ? (cartao.situacao || "Não informada") : "Regular"}</b></div>
          </div>
          {cartao ? (
            <span className="dp"><i style={{ background: st?.cls === "ok" ? "#7BE0A6" : "#F5B97A" }} /> {st ? st.txt : "Consultado"} · consultado em {ultima?.id && consultasCnh?.find((c: any) => c.id === ultima.id) ? new Date((consultasCnh.find((c: any) => c.id === ultima.id) as any).created_at).toLocaleDateString("pt-BR") : "hoje"}</span>
          ) : (
            <>
              <div style={{ height: 34 }} />
              <div className="lock">
                <div className="lt">🔒 Veja sua CNH completa</div>
                <div className="ls">Categoria, registro, validade oficial, pontos e situação, direto do Detran.</div>
                <button onClick={irParaConsulta}>Desbloquear por R$ {PRECO_CNH.toFixed(2).replace(".", ",")}</button>
              </div>
            </>
          )}
        </section>

        {cartao && (
          <section className="card pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div><div style={{ fontWeight: 800, fontSize: 14.5 }}>Pontos no Detran</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{cartao.ocorrencias ? `${cartao.ocorrencias} ocorrência(s) · limite para suspensão: 40 pontos` : "Nenhuma ocorrência registrada na consulta"}</div></div>
              <span style={{ fontSize: 26, fontWeight: 800, color: "var(--brand)" }}>{cartao.pontos != null ? cartao.pontos : "—"}</span>
            </div>
          </section>
        )}

        {/* consultar pontos/situação (GPT Motors, por CPF) */}
        <section className="card pad" ref={consultaRef as any}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><ShieldAlert size={16} style={{ color: "var(--brand)" }} /> {cartao ? "Atualizar minha CNH" : "Desbloquear minha CNH"}</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>{cartao ? "Consulta nova no Detran por CPF: pontos, situação e validade de hoje." : "Consulta oficial no Detran por CPF. O cartão acima fica completo e salvo no app."}</p>

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
              <b>Não consegui consultar.</b> {gptErroMsg(res.error)}
            </div>
          ) : null}

          {!res?.ok && (
            <>
              <input ref={cpfRef} className="field" inputMode="numeric" placeholder="CPF do motorista" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
              <button className="btn-primary" style={{ marginTop: 10 }} onClick={consultar} disabled={busy || cpfLimpo.length !== 11}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                {busy ? "Consultando…" : `${cartao ? "Atualizar" : "Desbloquear"} · R$ ${PRECO_CNH.toFixed(2).replace(".", ",")}`}
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
        <p className="foot-note">Não substitui a CNH digital oficial (Carteira Digital de Trânsito). Te aviso antes de vencer.</p>
      </div>
    </MgShell>
  );
}
