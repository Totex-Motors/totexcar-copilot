import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Download, Wallet, TrendingDown, Fuel, Gauge, Tag } from "lucide-react";
import { MgShell } from "@/components/mg/MgShell";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ReportRow {
  description: string | null;
  amount: number;
  type: string | null;
  transaction_date: string | null;
  odometer: number | null;
  categories: { name: string | null; color: string | null } | null;
}

function useReport(userId: string | undefined, months: number) {
  return useQuery({
    queryKey: ["report", userId, months],
    queryFn: async () => {
      if (!userId) return null;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const startStr = start.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("transactions")
        .select("description, amount, type, transaction_date, odometer, categories(name, color)")
        .eq("user_id", userId).gte("transaction_date", startStr).order("transaction_date", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as ReportRow[];
      const expenses = rows.filter((r) => r.type === "expense");
      const totalExpenses = expenses.reduce((s, r) => s + Math.abs(r.amount), 0);
      const totalIncome = rows.filter((r) => r.type === "income").reduce((s, r) => s + Math.abs(r.amount), 0);
      const byCat: Record<string, { total: number; color: string; count: number }> = {};
      expenses.forEach((r) => {
        const name = r.categories?.name || "Outros";
        if (!byCat[name]) byCat[name] = { total: 0, color: r.categories?.color || "#8A9994", count: 0 };
        byCat[name].total += Math.abs(r.amount); byCat[name].count += 1;
      });
      const categories = Object.entries(byCat)
        .map(([name, v]) => ({ name, ...v, pct: totalExpenses > 0 ? Math.round((v.total / totalExpenses) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);
      const fuel = byCat["Combustível"]?.total || 0;
      const odos = rows.map((r) => Number(r.odometer)).filter((n) => n > 0);
      const kmDriven = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : 0;
      const costPerKm = kmDriven > 0 ? totalExpenses / kmDriven : 0;
      return { rows, totalExpenses, totalIncome, net: totalIncome - totalExpenses, avgPerMonth: totalExpenses / months, categories, fuel, kmDriven, costPerKm, count: expenses.length };
    },
    enabled: !!userId,
  });
}

const PERIODS = [
  { value: "1", label: "Este mês" },
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
];
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// TELA RELATÓRIOS — gastos do carro por período, por categoria e export CSV. Padrão Minha Garagem.
const Reports = () => {
  const { userId, userData, loading } = useCurrentUser();
  const [months, setMonths] = useState("3");
  const { data: report, isLoading } = useReport(userId, Number(months));

  const exportCSV = () => {
    if (!report) return;
    const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Hodômetro"];
    const lines = report.rows.map((r) => [
      r.transaction_date || "", (r.description || "").replace(/;/g, ","), r.categories?.name || "",
      r.type === "income" ? "Receita" : "Gasto", Math.abs(r.amount).toFixed(2).replace(".", ","), r.odometer ? String(r.odometer) : "",
    ].join(";"));
    const csv = [header.join(";"), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `totex-car-gastos-${months}m.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#EEF2F0]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C6E6A]" /></div>;
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const top = report?.categories.slice(0, 6) || [];

  return (
    <MgShell title="Relatórios" back="/">
      <div className="stack">
        <div style={{ display: "flex", gap: 8 }}>
          <select className="field" value={months} onChange={(e) => setMonths(e.target.value)}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button className="sbtn" style={{ flex: "none" }} onClick={exportCSV} disabled={!report || report.count === 0}><Download size={15} /> CSV</button>
        </div>

        {isLoading ? (
          <div className="card pad" style={{ textAlign: "center", color: "var(--muted)" }}>Carregando relatório...</div>
        ) : !report || report.count === 0 ? (
          <div className="card pad" style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Nenhum gasto no período. Registre gastos pra ver os relatórios.</div>
        ) : (
          <>
            <div className="kpi">
              <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Wallet size={12} /> Total gasto</div><div className="v mono" style={{ color: "var(--gain)" }}>{brl(report.totalExpenses)}</div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{report.count} lançamento(s)</div></div>
              <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><TrendingDown size={12} /> Média/mês</div><div className="v mono">{brl(report.avgPerMonth)}</div></div>
            </div>
            <div className="kpi">
              <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Fuel size={12} /> Combustível</div><div className="v mono">{brl(report.fuel)}</div></div>
              <div className="box"><div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}><Gauge size={12} /> Custo por km</div><div className="v mono" style={{ color: "var(--brand)" }}>{report.costPerKm > 0 ? brl(report.costPerKm) : "—"}</div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{report.kmDriven > 0 ? `${report.kmDriven.toLocaleString("pt-BR")} km` : "informe o km"}</div></div>
            </div>

            <section className="card pad">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><Tag size={16} style={{ color: "var(--brand)" }} /> Gastos por categoria</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Onde o dinheiro do carro foi no período</div>
              <div className="stack" style={{ gap: 12 }}>
                {top.map((c) => (
                  <div key={c.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: c.color }} /> {c.name} <span style={{ color: "var(--muted)" }}>· {c.count}x</span></span>
                      <span style={{ fontWeight: 700 }}>{brl(c.total)} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({c.pct}%)</span></span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--card-2)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 999, width: `${c.pct}%`, background: c.color }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card pad">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Resumo do período</div>
              <div className="stack" style={{ gap: 10, fontSize: 13.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted)" }}>Total de gastos</span><span style={{ fontWeight: 700 }}>{brl(report.totalExpenses)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--muted)" }}>Receitas / reembolsos</span><span style={{ fontWeight: 700, color: "var(--good)" }}>{brl(report.totalIncome)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--line)" }}><span style={{ fontWeight: 700 }}>Saldo do período</span><span style={{ fontWeight: 800, color: report.net >= 0 ? "var(--good)" : "var(--ink)" }}>{brl(report.net)}</span></div>
              </div>
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={exportCSV}><Download size={16} /> Exportar gastos (CSV)</button>
            </section>
          </>
        )}

        <p className="foot-note">O custo por km usa o hodômetro dos seus lançamentos — registre o km junto dos gastos.</p>
      </div>
    </MgShell>
  );
};

export default Reports;
