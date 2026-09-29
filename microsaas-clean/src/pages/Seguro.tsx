import { Navigate, Link } from "react-router-dom";
import { ShieldCheck, Car, Users, LifeBuoy, MessageCircle, ChevronRight, Check } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";

const WA = "5511963786699";
function daysUntil(d?: string | null) { if (!d) return null; const [y, m, dd] = String(d).split("-").map(Number); if (!y) return null; const t = new Date(y, m - 1, dd); t.setHours(0, 0, 0, 0); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((t.getTime() - h.getTime()) / 864e5); }
const fmtBR = (d?: string | null) => { if (!d) return null; const [y, m, dd] = String(d).split("-"); return dd ? `${dd}/${m}/${y}` : d; };

// TELA MEU SEGURO — status do seguro (do cadastro) + cotação via Co-pilot/parceiro.
export default function Seguro() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const venc = (vehicle as any)?.seguro_vencimento || null;
  const d = daysUntil(venc);
  const carro = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") : "seu carro";
  const wa = `https://wa.me/${WA}?text=${encodeURIComponent(`Quero cotar um seguro pro meu ${carro} 🚗`)}`;

  const coberturas = [
    { ic: Car, t: "Colisão, incêndio e roubo", s: "O básico bem coberto" },
    { ic: Users, t: "Danos a terceiros", s: "Se você bater em alguém" },
    { ic: LifeBuoy, t: "Assistência 24h", s: "Guincho, chaveiro, pane seca" },
  ];

  return (
    <MgShell title="Meu seguro" back="/">
      <div className="stack">
        {/* status */}
        <section className="hero" style={{ background: venc ? "linear-gradient(150deg,#0C6E6A,#0A5350)" : "linear-gradient(150deg,#B8621A,#8f4a13)" }}>
          <div className="eyebrow">Proteção do carro</div>
          {venc ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{d != null && d < 0 ? "Seguro vencido" : "Seguro ativo"}</div>
              <span className="trend" style={{ marginTop: 8 }}><ShieldCheck size={13} /> Vence {fmtBR(venc)}</span>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>Você está sem proteção</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,.85)", marginTop: 6 }}>Um seguro te cobre em roubo, batida e ainda dá assistência 24h. Faça uma cotação rápida.</p>
            </>
          )}
        </section>

        <a href={wa} target="_blank" rel="noreferrer"><button className="btn-primary"><ShieldCheck size={17} /> {venc ? "Renovar / recotar" : "Cotar meu seguro"}</button></a>

        <div>
          <div className="eyebrow" style={{ margin: "2px 2px 10px" }}>O que costuma cobrir</div>
          <section className="card">
            {coberturas.map((c) => {
              const Ic = c.ic;
              return (
                <div key={c.t} className="list-row">
                  <span className="offer-ico"><Ic size={19} /></span>
                  <div style={{ flex: 1 }}><div className="t">{c.t}</div><div className="s">{c.s}</div></div>
                  <Check size={18} style={{ color: "var(--good)" }} />
                </div>
              );
            })}
          </section>
        </div>

        <a className="copilot" href={wa} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Cotação em minutos</div>
            <div className="s">A gente compara com parceiros e te manda as opções no WhatsApp.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        {venc && <Link to="/settings" className="foot-note" style={{ display: "block" }}>Atualizar a data do seguro no cadastro</Link>}
        <p className="foot-note">Cotação feita por corretor/parceiro. Você decide se contrata — sem compromisso.</p>
      </div>
    </MgShell>
  );
}
