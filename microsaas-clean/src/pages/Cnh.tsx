import { Navigate, Link } from "react-router-dom";
import { IdCard, CalendarDays, ChevronRight, MessageCircle, ShieldAlert, Pencil, Info } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";

const WA = "5511963786699";

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
  const { userData, loading } = useCurrentUser();
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

        {/* consultar pontos */}
        <a className="card list-row" href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero consultar os pontos da minha CNH")}`} target="_blank" rel="noreferrer">
          <span className="offer-ico"><ShieldAlert size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Pontos na CNH</div><div className="s">Consulte quantos pontos você tem</div></div>
          <span className="cta">Consultar</span>
        </a>

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
