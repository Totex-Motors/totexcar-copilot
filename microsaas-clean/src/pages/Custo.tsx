import { Navigate, Link } from "react-router-dom";
import { Route as RouteIcon, CalendarRange, MessageCircle, ChevronRight, TrendingDown } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useCusto } from "@/hooks/useCusto";

const WA = "5511963786699";
const brl = (v?: number | null) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const COR: Record<string, string> = {
  "Combustível": "#C9781E", "Manutenção": "#0C6E6A", "Fixos (imposto/seguro)": "#2f80ed",
  "Financiamento": "#8A4FBE", "Outros": "#8A9994",
};

// TELA CUSTO DO CARRO — custo real por km (CPK), custo mensal e pra onde vai o dinheiro (useCusto).
export default function Custo() {
  const { userId, userData, loading } = useCurrentUser();
  const { data: custo, isLoading } = useCusto(userId);
  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  return (
    <MgShell title="Custo do carro" back="/">
      <div className="stack">
        {isLoading ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Calculando...</div>
        ) : !custo ? (
          <div className="card pad" style={{ textAlign: "center" }}>
            <TrendingDown size={34} style={{ opacity: .4, margin: "6px auto", color: "var(--brand)" }} />
            <div style={{ fontWeight: 700 }}>Ainda sem custo calculado</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Registre alguns gastos com o km do hodômetro que eu calculo quanto seu carro custa por mês e por km. Manda cupom + km no WhatsApp. 🚗</p>
          </div>
        ) : (
          <>
            {/* CPK + mensal */}
            <div className="kpi">
              <div className="box"><div className="l">Custo por km</div><div className="v mono" style={{ color: "var(--brand)" }}>{brl(custo.custo_por_km)}</div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><RouteIcon size={12} /> {custo.km_rodados.toLocaleString("pt-BR")} km</div></div>
              <div className="box"><div className="l">Custo mensal</div><div className="v mono">{brl(custo.custo_mensal)}</div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><CalendarRange size={12} /> ~{custo.meses} {custo.meses > 1 ? "meses" : "mês"}</div></div>
            </div>

            {/* pra onde vai o dinheiro */}
            <section className="card pad">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Pra onde vai o dinheiro</div>
              <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--card-2)" }}>
                {custo.buckets.map((b) => <div key={b.label} style={{ width: `${b.pct}%`, background: COR[b.label] || "#8A9994" }} title={`${b.label}: ${b.pct}%`} />)}
              </div>
              <div className="stack" style={{ marginTop: 12 }}>
                {custo.buckets.map((b) => (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: COR[b.label] || "#8A9994" }} /> {b.label}</span>
                    <span><b>{brl(b.valor)}</b> <span style={{ color: "var(--muted)" }}>· {b.pct}%</span></span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <TrendingDown size={14} style={{ color: "var(--brand)" }} /> Total no período: <b style={{ color: "var(--ink)" }}>{brl(custo.total)}</b> · {custo.lancamentos} lançamentos
              </p>
            </section>

            <Link to="/transactions" className="card list-row">
              <span className="offer-ico"><RouteIcon size={19} /></span>
              <div style={{ flex: 1 }}><div className="t">Ver todos os gastos</div><div className="s">Extrato completo</div></div>
              <ChevronRight size={20} style={{ color: "var(--faint)" }} />
            </Link>
          </>
        )}

        {/* co-pilot */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero registrar um gasto do carro 🧾")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Registre gastos no WhatsApp</div>
            <div className="s">Manda a foto do cupom + o km — eu lanço e recalculo o custo na hora.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <p className="foot-note">O custo por km fica mais preciso quanto mais você registra (com o hodômetro).</p>
      </div>
    </MgShell>
  );
}
