import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Wallet, TrendingDown, Fuel, Gauge, Tag } from "lucide-react";
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
        .eq("user_id", userId)
        .gte("transaction_date", startStr)
        .order("transaction_date", { ascending: false });
      if (error) throw error;

      const rows = (data || []) as unknown as ReportRow[];
      const expenses = rows.filter((r) => r.type === "expense");
      const totalExpenses = expenses.reduce((s, r) => s + Math.abs(r.amount), 0);
      const totalIncome = rows.filter((r) => r.type === "income").reduce((s, r) => s + Math.abs(r.amount), 0);

      const byCat: Record<string, { total: number; color: string; count: number }> = {};
      expenses.forEach((r) => {
        const name = r.categories?.name || "Outros";
        if (!byCat[name]) byCat[name] = { total: 0, color: r.categories?.color || "#6b7280", count: 0 };
        byCat[name].total += Math.abs(r.amount);
        byCat[name].count += 1;
      });
      const categories = Object.entries(byCat)
        .map(([name, v]) => ({ name, ...v, pct: totalExpenses > 0 ? Math.round((v.total / totalExpenses) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);

      const fuel = byCat["Combustível"]?.total || 0;

      // km rodados no período (a partir do hodômetro registrado nos gastos)
      const odos = rows.map((r) => Number(r.odometer)).filter((n) => n > 0);
      const kmDriven = odos.length >= 2 ? Math.max(...odos) - Math.min(...odos) : 0;
      const costPerKm = kmDriven > 0 ? totalExpenses / kmDriven : 0;

      return {
        rows,
        totalExpenses,
        totalIncome,
        net: totalIncome - totalExpenses,
        avgPerMonth: totalExpenses / months,
        categories,
        fuel,
        kmDriven,
        costPerKm,
        count: expenses.length,
      };
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

const Reports = () => {
  const { userId } = useCurrentUser();
  const [months, setMonths] = useState("3");
  const { data: report, isLoading } = useReport(userId, Number(months));

  const periodLabel = PERIODS.find((p) => p.value === months)?.label || "";

  const exportCSV = () => {
    if (!report) return;
    const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Hodômetro"];
    const lines = report.rows.map((r) => [
      r.transaction_date || "",
      (r.description || "").replace(/;/g, ","),
      r.categories?.name || "",
      r.type === "income" ? "Receita" : "Gasto",
      Math.abs(r.amount).toFixed(2).replace(".", ","),
      r.odometer ? String(r.odometer) : "",
    ].join(";"));
    const csv = [header.join(";"), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `totex-car-finance-gastos-${months}m.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const top = report?.categories.slice(0, 6) || [];

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Gastos do seu carro — {periodLabel.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!report || report.count === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Carregando relatório...</div>
      ) : !report || report.count === 0 ? (
        <Card className="border-0 shadow-premium-md">
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhum gasto registrado no período. Registre gastos para ver os relatórios.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="w-4 h-4" /> Total gasto</div>
              <div className="text-2xl font-bold mt-1">{brl(report.totalExpenses)}</div>
              <div className="text-xs text-muted-foreground mt-1">{report.count} lançamento(s)</div>
            </CardContent></Card>
            <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingDown className="w-4 h-4" /> Média por mês</div>
              <div className="text-2xl font-bold mt-1">{brl(report.avgPerMonth)}</div>
            </CardContent></Card>
            <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Fuel className="w-4 h-4" /> Combustível</div>
              <div className="text-2xl font-bold mt-1">{brl(report.fuel)}</div>
            </CardContent></Card>
            <Card className="border-0 shadow-premium-md"><CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Gauge className="w-4 h-4" /> Custo por km</div>
              <div className="text-2xl font-bold mt-1">{report.costPerKm > 0 ? brl(report.costPerKm) : "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">{report.kmDriven > 0 ? `${report.kmDriven.toLocaleString("pt-BR")} km no período` : "informe o hodômetro nos gastos"}</div>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Gastos por categoria */}
            <Card className="border-0 shadow-premium-md xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Tag className="w-5 h-5" /> Gastos por categoria</CardTitle>
                <p className="text-sm text-muted-foreground">Onde o dinheiro do carro foi no período</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {top.map((c) => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">· {c.count}x</span>
                      </div>
                      <span className="font-semibold">{brl(c.total)} <span className="text-muted-foreground font-normal">({c.pct}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Resumo do período */}
            <Card className="border-0 shadow-premium-md">
              <CardHeader><CardTitle>Resumo do período</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total de gastos:</span>
                  <span className="font-semibold">{brl(report.totalExpenses)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Receitas/reembolsos:</span>
                  <span className="font-semibold text-success">{brl(report.totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-medium">Saldo do período:</span>
                  <span className={`font-bold ${report.net >= 0 ? "text-success" : "text-foreground"}`}>{brl(report.net)}</span>
                </div>
                <div className="pt-2">
                  <h4 className="font-semibold mb-2">Maior categoria</h4>
                  {top[0] ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: top[0].color }} />
                        <span className="text-sm">{top[0].name}</span>
                      </div>
                      <Badge variant="secondary">{top[0].pct}%</Badge>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </div>
                <Button variant="outline" className="w-full" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-2" /> Exportar gastos (CSV)
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Reports;
