import { Navigate } from "react-router-dom";
import { FileCheck2, ShieldAlert, Gavel, AlertTriangle, MessageCircle, ChevronRight, Check } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useVehicle } from "@/hooks/useAccounts";

const WA = "5511963786699";

// TELA HISTÓRICO (consulta cautelar) — tela de consulta: explica o que a cautelar mostra e leva
// pro Co-pilot fechar a consulta (parceiro). Sem inventar dados: é uma consulta paga sob demanda.
export default function Historico() {
  const { userData, userId, loading } = useCurrentUser();
  const { vehicle } = useVehicle(userId);
  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const placa = vehicle?.placa || "";
  const wa = `https://wa.me/${WA}?text=${encodeURIComponent(`Quero a consulta cautelar do meu carro${placa ? ` (placa ${placa})` : ""} 🔎`)}`;
  const itens = [
    { ic: Gavel, t: "Leilão e sinistro", s: "Se o carro já foi a leilão ou teve perda total" },
    { ic: AlertTriangle, t: "Roubo e furto", s: "Registro de ocorrência e recuperação" },
    { ic: ShieldAlert, t: "Débitos e restrições", s: "IPVA, multas, financeira e judicial" },
    { ic: FileCheck2, t: "Batidas de motor/chassi", s: "Se os números conferem" },
  ];

  return (
    <MgShell title="Histórico do carro" back="/">
      <div className="stack">
        <section className="hero" style={{ background: "linear-gradient(150deg,#0C6E6A,#0A5350)" }}>
          <div className="eyebrow">Consulta cautelar</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>A ficha completa do carro</div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.82)", marginTop: 6 }}>Antes de comprar, vender ou ficar tranquilo: descubra o passado do veículo{placa ? ` — placa ${placa}` : ""}.</p>
        </section>

        <div>
          <div className="eyebrow" style={{ margin: "2px 2px 10px" }}>O que a consulta mostra</div>
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

        <a href={wa} target="_blank" rel="noreferrer"><button className="btn-primary"><FileCheck2 size={17} /> Consultar histórico</button></a>

        <a className="copilot" href={wa} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Consulta pelo Co-pilot</div>
            <div className="s">A gente faz pelo parceiro e te manda o laudo no WhatsApp.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <p className="foot-note">Consulta paga, feita sob demanda por parceiro credenciado. Ideal na hora de comprar ou vender.</p>
      </div>
    </MgShell>
  );
}
