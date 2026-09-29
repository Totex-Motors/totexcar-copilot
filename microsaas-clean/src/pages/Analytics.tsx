import { Navigate, Link } from "react-router-dom";
import { BarChart3, PieChart, MessageCircle, ChevronRight, Receipt } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMonthlyTrend } from "@/hooks/useMonthlyTrend";
import { useCategoryStats } from "@/hooks/useAnalytics";
import { useMonthlyStats } from "@/hooks/useTransactions";

const WA = "5511963786699";
const brl = (v?: number | null) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(v));
const PALETTE = ["#0C6E6A", "#C9781E", "#2f80ed", "#8A4FBE", "#1F8A54", "#B8621A", "#8A9994"];

// TELA ANÁLISES — visão do dinheiro do carro: gasto por mês (últimos 6) e pra onde vai (categorias).
// Tudo com dado real (useMonthlyTrend + useCategoryStats). Sem números inventados.
export default function Analytics() {
  const { userId, userData, loading } = useCurrentUser();
  const { data: trend = [], isLoading: loadingTrend } = useMonthlyTrend(userId);
  const { data: cats = [], isLoading: loadingCats } = useCategoryStats(userId);
  const { data: monthly } = useMonthlyStats(userId);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const maxExp = Math.max(1, ...trend.map((m) => m.expenses));
  const hasData = trend.some((m) => m.expenses > 0) || cats.length > 0;
  const top = cats[0];
  const catColor = (i: number, c?: string) => c || PALETTE[i % PALETTE.length];

  return (
    <MgShell title="Análises" back="/">
      <div className="stack">
        {/* resumo do mês */}
        <div className="kpi">
          <div className="box"><div className="l">Gasto no mês</div><div className="v mono" style={{ color: "var(--gain)" }}>{brl(monthly?.expenses)}</div></div>
          <div className="box"><div className="l">Categoria top</div><div className="v" style={{ fontSize: 15 }}>{top?.category || "—"}</div>{top && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{top.percentage}% dos gastos</div>}</div>
        </div>

        {!hasData && !loadingTrend && !loadingCats ? (
          <div className="card pad" style={{ textAlign: "center" }}>
            <Receipt size={34} style={{ opacity: .4, margin: "6px auto", color: "var(--brand)" }} />
            <div style={{ fontWeight: 700 }}>Sem dados ainda</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Assim que você registrar alguns gastos, eu mostro pra onde vai o dinheiro do carro, mês a mês.</p>
          </div>
        ) : (
          <>
            {/* gasto por mês */}
            <section className="card pad">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><BarChart3 size={16} style={{ color: "var(--brand)" }} /> Gasto por mês</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Últimos 6 meses</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 130 }}>
                {trend.map((m, i) => {
                  const h = Math.round((m.expenses / maxExp) * 100);
                  const isLast = i === trend.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)" }} className="mono">{m.expenses > 0 ? Math.round(m.expenses / 100) / 10 + "k" : ""}</div>
                      <div style={{ width: "72%", height: `${Math.max(h, 3)}%`, minHeight: 4, borderRadius: "6px 6px 0 0", background: isLast ? "var(--brand)" : "var(--brand-soft)", transition: "height .3s" }} title={brl(m.expenses)} />
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: isLast ? "var(--brand)" : "var(--faint)", textTransform: "capitalize" }}>{m.month}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* pra onde vai o dinheiro (categorias, mês atual) */}
            {cats.length > 0 && (
              <section className="card pad">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><PieChart size={16} style={{ color: "var(--brand)" }} /> Pra onde vai o dinheiro</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Gastos deste mês por categoria</div>
                <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--card-2)" }}>
                  {cats.map((c: any, i: number) => <div key={c.category} style={{ width: `${c.percentage}%`, background: catColor(i, c.color) }} title={`${c.category}: ${c.percentage}%`} />)}
                </div>
                <div className="stack" style={{ marginTop: 14, gap: 10 }}>
                  {cats.map((c: any, i: number) => (
                    <div key={c.category} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: catColor(i, c.color) }} /> {c.category}</span>
                      <span><b>{brl(c.amount)}</b> <span style={{ color: "var(--muted)" }}>· {c.percentage}%</span></span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <Link to="/transactions" className="card list-row">
          <span className="offer-ico"><Receipt size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Ver todos os gastos</div><div className="s">Extrato completo</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        {/* co-pilot */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero entender melhor os gastos do meu carro 📊")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Pergunte ao Co-pilot</div>
            <div className="s">"Onde eu tô gastando demais?" · "Vale a pena trocar?" — ele analisa e responde.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <p className="foot-note">Quanto mais você registra, mais preciso fica o retrato do custo do seu carro.</p>
      </div>
    </MgShell>
  );
}
