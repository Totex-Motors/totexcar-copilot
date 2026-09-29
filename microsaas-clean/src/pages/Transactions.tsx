import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Search, Trash2, MessageCircle, ChevronRight, Receipt, LineChart, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { useTransactions, useDeleteTransaction, useMonthlyStats, type Transaction } from "@/hooks/useTransactions";

const WA = "5511963786699";
const brl = (v?: number | null) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(v));
const fmtDate = (d?: string | null) => { if (!d) return ""; const [y, m, day] = String(d).split("T")[0].split("-"); return day && m && y ? `${day}/${m}/${y}` : String(d); };

// TELA GASTOS DO CARRO — extrato dos lançamentos (combustível, peças, revisão, seguro, IPVA, multas...)
// Registro entra pelo Co-pilot no WhatsApp (foto do cupom + km). Aqui é consulta + apagar.
export default function Transactions() {
  const { userId, userData, loading } = useCurrentUser();
  const { data: transactions, isLoading } = useTransactions(userId);
  const { data: monthly } = useMonthlyStats(userId);
  const del = useDeleteTransaction();
  const [q, setQ] = useState("");

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const list = (transactions || []).filter((t: any) => t.description?.toLowerCase().includes(q.toLowerCase()));

  const handleDelete = (t: Transaction) => {
    if (window.confirm(`Apagar "${t.description || "este gasto"}"?`)) del.mutate(t.id);
  };

  return (
    <MgShell title="Gastos do carro" back="/">
      <div className="stack">
        {/* resumo do mês */}
        <div className="kpi">
          <div className="box"><div className="l">Gasto no mês</div><div className="v mono" style={{ color: "var(--gain)" }}>{brl(monthly?.expenses)}</div></div>
          <div className="box"><div className="l">Lançamentos</div><div className="v mono">{transactions?.length ?? 0}</div></div>
        </div>

        {/* busca */}
        <div style={{ position: "relative" }}>
          <Search size={17} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
          <input className="field" style={{ paddingLeft: 40 }} placeholder="Buscar gasto..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {/* extrato */}
        {isLoading ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Carregando...</div>
        ) : list.length === 0 ? (
          <div className="card pad" style={{ textAlign: "center" }}>
            <Receipt size={34} style={{ opacity: .4, margin: "6px auto", color: "var(--brand)" }} />
            <div style={{ fontWeight: 700 }}>{q ? "Nada encontrado" : "Nenhum gasto ainda"}</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Manda a foto do cupom + o km no WhatsApp que o Co-pilot lança pra você.</p>
          </div>
        ) : (
          <section className="card">
            {list.map((t: any) => {
              const inc = t.type === "income";
              const cor = t.categories?.color || "var(--brand)";
              return (
                <div key={t.id} className="list-row">
                  <span className="offer-ico" style={{ background: inc ? "var(--good-soft)" : "var(--gain-soft)", color: inc ? "var(--good)" : "var(--warn)" }}>
                    {inc ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description || "Sem descrição"}</div>
                    <div className="s" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {t.categories?.name && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: cor, flex: "none" }} /> {t.categories.name}</span>}
                      <span>· {fmtDate(t.transaction_date)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div className="mono" style={{ fontWeight: 800, fontSize: 14.5, color: inc ? "var(--good)" : "var(--ink)" }}>{inc ? "+" : "-"}{brl(t.amount)}</div>
                    <button onClick={() => handleDelete(t)} aria-label="Apagar" style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", padding: "4px 0 0", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                      <Trash2 size={13} /> apagar
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <Link to="/analytics" className="card list-row">
          <span className="offer-ico"><LineChart size={19} /></span>
          <div style={{ flex: 1 }}><div className="t">Ver análises</div><div className="s">Pra onde vai o dinheiro, por mês</div></div>
          <ChevronRight size={20} style={{ color: "var(--faint)" }} />
        </Link>

        {/* co-pilot */}
        <a className="copilot" href={`https://wa.me/${WA}?text=${encodeURIComponent("Quero registrar um gasto do carro 🧾")}`} target="_blank" rel="noreferrer">
          <span className="av"><MessageCircle size={22} /></span>
          <div>
            <div className="t">Registrar gasto no WhatsApp</div>
            <div className="s">Manda a foto do cupom + o km — o Co-pilot lança e categoriza na hora.</div>
          </div>
          <span className="go"><ChevronRight size={18} /></span>
        </a>

        <p className="foot-note">Combustível, peças, revisão, seguro, IPVA, multas — tudo num lugar só.</p>
      </div>
    </MgShell>
  );
}
