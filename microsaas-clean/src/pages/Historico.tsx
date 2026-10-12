import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { FileCheck2, ShieldAlert, Gavel, AlertTriangle, MessageCircle, ChevronRight, Check, Loader2, Sparkles, Search, Car } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";
import { runGptConsulta, startGptCheckout, fetchUltimaConsulta, fetchConsultaById, useMinhasConsultas, gptErroMsg, type GptResult } from "@/hooks/useGptMotors";

const WA = "5511963786699";
const PRECO = 69; // preço de exibição (o valor final vem do servidor)
const fmtDT = (s?: string) => s ? new Date(s).toLocaleDateString("pt-BR") : "";
// Um bloco da cautelar só vira ALERTA se trouxer registro de fato: lista com itens, ou um sinal
// "possui/existe/consta" = sim. Objeto preenchido dizendo "não possui" é ficha limpa.
function temAlerta(v: any): boolean {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v !== "object") return /^(sim|s|true|consta|existe)/i.test(String(v));
  const flags = Object.entries(v).filter(([k]) => /^(possui|existe|consta|tem|indicio|registro)/i.test(k));
  if (flags.length) return flags.some(([, x]) => x === true || /^(sim|s|true|consta|existe)/i.test(String(x)));
  const listas = Object.values(v).filter(Array.isArray) as any[][];
  if (listas.length) return listas.some((l) => l.length > 0);
  return true; // formato desconhecido: melhor pedir pra verificar do que dizer "nada consta"
}

// TELA HISTÓRICO — Raio-X do Carro (Veicular PRO via GPT Motors): procedência, débitos, leilão,
// sinistro, gravame, roubo/furto — resumido pela IA. Consulta paga sob demanda.
export default function Historico() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  const { data: laudos } = useMinhasConsultas(userId, "raiox");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GptResult | null>(null);
  const [params, setParams] = useSearchParams();

  // Retorno do pagamento: o webhook roda a consulta (o Raio-X leva ~1,5 min) — busca o resultado por até 3 min.
  useEffect(() => {
    if (params.get("status") !== "success" || !userId) return;
    const placa = vehicle?.placa || "";
    setBusy(true);
    let tries = 0;
    const tick = async () => {
      const r = await fetchUltimaConsulta(userId, "raiox", placa || undefined);
      if (r) { setRes(r); setBusy(false); setParams({}, { replace: true }); return; }
      if (++tries >= 60) { setBusy(false); setParams({}, { replace: true }); return; }
      setTimeout(tick, 3000);
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, userId, vehicle?.placa]);

  // última consulta paga desta placa → cartão desbloqueado (fica preenchido até a próxima)
  useEffect(() => {
    const pl = vehicle?.placa || "";
    if (!userId || !pl || params.get("status") === "success") return;
    fetchUltimaConsulta(userId, "raiox", pl).then((r) => { if (r) setRes((atual) => atual || r); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, vehicle?.placa]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const placa = vehicle?.placa || "";
  const wa = `https://wa.me/${WA}?text=${encodeURIComponent(`Quero o Raio-X do meu carro${placa ? ` (placa ${placa})` : ""} 🔎`)}`;

  const consultar = async () => {
    if (!placa || busy) return;
    setBusy(true); setRes(null);
    let r = await runGptConsulta("raiox", placa);
    // estourou o tempo, mas o provedor termina e guarda o laudo: a 2ª chamada traz na hora (sem cobrar de novo)
    if (!r.ok && r.error === "provedor_demorou") r = await runGptConsulta("raiox", placa);
    setRes(r); setBusy(false);
  };

  const itens = [
    { ic: Gavel, t: "Leilão e sinistro", s: "Se já foi a leilão ou teve perda total" },
    { ic: AlertTriangle, t: "Roubo e furto", s: "Registro de ocorrência" },
    { ic: ShieldAlert, t: "Débitos e restrições", s: "IPVA, multas, financeira, judicial" },
    { ic: FileCheck2, t: "Gravame e procedência", s: "Financiamento e dados do veículo" },
  ];
  const basicos = res?.dados?.veiculoDadosBasicos || null;
  const checks: [string, any][] = [
    ["Leilão", res?.dados?.leilaoDados], ["Sinistro", res?.dados?.sinistroDados],
    ["Roubo / furto", res?.dados?.rouboFurtoDados], ["Gravame", res?.dados?.gravameDados],
  ];
  const alertas = res?.ok ? checks.filter(([, v]) => temAlerta(v)).length : 0;
  const consultadoEm = res?.id ? (laudos as any[] | undefined)?.find((c: any) => c.id === res.id)?.created_at : null;

  return (
    <MgShell title="Raio-X do carro" back="/">
      <div className="stack">
        {/* cartão da cautelar: bloqueado até a consulta paga; depois fica preenchido */}
        <section className="doc-card">
          <div className="dh">
            <div style={{ minWidth: 0 }}><div className="dl">Raio-X · consulta cautelar</div><div className="dn">{[vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "Meu carro"}{placa ? ` · ${placa}` : ""}</div></div>
            <div className={`dcat ${res?.ok ? "" : "blur"}`}><b>{res?.ok ? alertas : 0}</b><small>ALERTAS</small></div>
          </div>
          <div className={`dg ${res?.ok ? "" : "blur"}`}>
            {checks.map(([label, val]) => (
              <div key={label}><span className="dl">{label}</span><b style={res?.ok && temAlerta(val) ? { color: "#FED7AA" } : undefined}>{res?.ok ? (temAlerta(val) ? "Verificar" : "Nada consta") : "Nada consta"}</b></div>
            ))}
          </div>
          {res?.ok ? (
            <span className="dp"><i style={{ background: alertas ? "#F5B97A" : "#7BE0A6" }} /> {alertas ? "Tem ponto de atenção" : "Ficha limpa"} · consultado em {consultadoEm ? new Date(consultadoEm).toLocaleDateString("pt-BR") : "hoje"}</span>
          ) : (
            <>
              <div style={{ height: 34 }} />
              <div className="lock">
                <div className="lt">🔒 Descubra a ficha do seu carro</div>
                <div className="ls">Leilão, sinistro, roubo/furto, gravame e procedência, em uma consulta.</div>
                <button onClick={consultar} disabled={busy || !placa}>{busy ? "Consultando… (até 2 min)" : `Desbloquear por R$ ${PRECO}`}</button>
              </div>
            </>
          )}
        </section>

        {!placa && (
          <Link to="/settings" className="card alert-card">
            <span className="alert-ico"><Car size={20} /></span>
            <div style={{ flex: 1 }}><div className="t">Cadastre a placa do carro</div><div className="s">Preciso da placa pra puxar o Raio-X</div></div>
            <ChevronRight size={20} style={{ color: "var(--faint)" }} />
          </Link>
        )}

        {/* RESULTADO */}
        {res?.ok && (
          <section className="card pad">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="badge-p" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Sparkles size={12} /> Resultado</span>
              {res.cached && <span className="tag mut">de consulta recente</span>}
            </div>
            {basicos && (
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                {[basicos.marca, basicos.modelo].filter(Boolean).join(" ") || placa}{basicos.anoModelo ? ` · ${basicos.anoModelo}` : ""}
              </div>
            )}
            {res.analiseIA ? (
              <p style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{res.analiseIA}</p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Consulta concluída. Veja os detalhes com o Co-pilot.</p>
            )}
            <div className="grid" style={{ marginTop: 12 }}>
              {[
                ["Leilão", res.dados?.leilaoDados],
                ["Sinistro", res.dados?.sinistroDados],
                ["Roubo/Furto", res.dados?.rouboFurtoDados],
                ["Gravame", res.dados?.gravameDados],
              ].map(([label, val]) => (
                <div key={label as string} className="box" style={{ flex: 1 }}>
                  <div className="l">{label as string}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: temAlerta(val) ? "var(--warn)" : "var(--good)" }}>{temAlerta(val) ? "Verificar" : "Nada consta"}</div>
                </div>
              ))}
            </div>
            <a className="sbtn wa" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Entender o resultado com o Co-pilot</a>
          </section>
        )}

        {/* PAGAMENTO / ERRO */}
        {res && !res.ok && res.needsPayment && (
          <section className="card pad" style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Raio-X completo por {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO}`}</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 12px" }}>Pague no Pix ou cartão e o resultado aparece aqui na hora.</p>
            <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); const r = await startGptCheckout("raiox", placa); if (!r.ok) { setBusy(false); alert("Não consegui abrir o pagamento: " + (r.error || "")); } }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Pagar {res.preco ? `R$ ${res.preco}` : `R$ ${PRECO}`}
            </button>
            <a style={{ display: "block", marginTop: 10, fontSize: 12.5, color: "var(--muted)" }} href={wa} target="_blank" rel="noreferrer">ou falar com o Co-pilot no WhatsApp</a>
          </section>
        )}
        {res && !res.ok && !res.needsPayment && (
          <div className="card pad" style={{ background: "var(--gain-soft)", borderColor: "transparent", fontSize: 13 }}>
            <b>Não consegui puxar agora.</b> {gptErroMsg(res.error)}
          </div>
        )}

        {/* AÇÃO */}
        {placa && (
          <button className="btn-primary" onClick={consultar} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            {busy ? "Consultando… (até 2 min)" : res?.ok ? "Consultar de novo" : `Consultar Raio-X · R$ ${PRECO}`}
          </button>
        )}

        {/* O QUE MOSTRA */}
        <div>
          <div className="eyebrow" style={{ margin: "2px 2px 10px" }}>O que o Raio-X mostra</div>
          <section className="card">
            {itens.map((i) => {
              const Ic = i.ic;
              return (
                <div key={i.t} className="list-row">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}><div className="t">{i.t}</div><div className="s">{i.s}</div></div>
                  <Check size={18} style={{ color: "var(--good)" }} />
                </div>
              );
            })}
          </section>
        </div>

        {/* MEUS LAUDOS */}
        {laudos && laudos.length > 0 && (
          <div>
            <div className="eyebrow" style={{ margin: "2px 2px 10px" }}>Meus Raio-X</div>
            <section className="card">
              {laudos.map((l: any) => (
                <button key={l.id} className="list-row" style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
                  onClick={async () => { const r = await fetchConsultaById(l.id); if (r) { setRes(r); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>
                  <span className="offer-ico"><FileCheck2 size={18} /></span>
                  <div style={{ flex: 1 }}><div className="t">{l.placa}</div><div className="s">{fmtDT(l.created_at)}</div></div>
                  <span className="tag ok" style={{ alignSelf: "center" }}>Ver</span>
                </button>
              ))}
            </section>
          </div>
        )}

        <p className="foot-note">Consulta paga, feita na hora pelo provedor credenciado. Ideal na hora de comprar, vender ou ficar tranquilo.</p>
      </div>
    </MgShell>
  );
}
