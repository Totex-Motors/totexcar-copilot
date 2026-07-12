import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { MonthlyTrend } from "@/components/dashboard/MonthlyTrend";
import { VehicleExpirations } from "@/components/dashboard/VehicleExpirations";
import { Wallet, Fuel, TrendingDown, Gauge } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMonthlyStats, useTotalSpent, useFuelThisMonth } from "@/hooks/useTransactions";
import { useVehicle } from "@/hooks/useAccounts";
import { WhatsAppConnectCard } from "@/components/WhatsAppConnectCard";
import { ConsumoCard } from "@/components/dashboard/ConsumoCard";
import { LucroProCard } from "@/components/dashboard/LucroProCard";

const Index = () => {
  const { userData, userId, loading } = useCurrentUser();
  const { data: monthlyStats } = useMonthlyStats(userId);
  const { data: totals } = useTotalSpent(userId);
  const { data: fuelMonth } = useFuelThisMonth(userId);
  const { vehicle } = useVehicle(userId);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

  const formatChange = (change: number) => {
    const formatted = Math.abs(change).toFixed(1);
    return `${change >= 0 ? "+" : "-"}${formatted}%`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Lojista não tem dashboard de veículo — vai para o painel da loja
  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  if (!userData) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-foreground mb-2">Bem-vindo ao TotexCar Co-pilot!</h2>
          <p className="text-muted-foreground">Cadastre seu veículo em "Meu Veículo" para começar.</p>
        </div>
      </DashboardLayout>
    );
  }

  const vehicleSubtitle = vehicle
    ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") + (vehicle.placa ? ` · ${vehicle.placa}` : "")
    : "Cadastre seu veículo em Meu Veículo";

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Olá, {userData.name || "Proprietário"}! 🚗</h1>
        <p className="text-muted-foreground">
          {vehicle ? `Visão geral dos gastos de ${vehicle.name} — ${vehicleSubtitle}` : vehicleSubtitle}
        </p>
      </div>

      {/* Onboarding: direciona pro assistente no WhatsApp (some ao fechar) */}
      <WhatsAppConnectCard />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatsCard
          title="Total Gasto"
          value={formatCurrency(totals?.totalExpenses || 0)}
          icon={<Wallet className="w-6 h-6" />}
          gradient="primary"
        />
        <StatsCard
          title="Gastos do Mês"
          value={formatCurrency(monthlyStats?.expenses || 0)}
          change={
            monthlyStats?.changes.expenses
              ? {
                  value: formatChange(monthlyStats.changes.expenses),
                  type: monthlyStats.changes.expenses >= 0 ? "increase" : "decrease",
                }
              : undefined
          }
          icon={<TrendingDown className="w-6 h-6" />}
          gradient="warning"
        />
        <StatsCard
          title="Combustível (mês)"
          value={formatCurrency(fuelMonth || 0)}
          icon={<Fuel className="w-6 h-6" />}
          gradient="success"
        />
        <StatsCard
          title="Hodômetro"
          value={vehicle?.hodometro ? `${Number(vehicle.hodometro).toLocaleString("pt-BR")} km` : "—"}
          icon={<Gauge className="w-6 h-6" />}
          gradient="primary"
        />
      </div>

      {/* Modo Motorista PRO: convite ou lucro da semana */}
      <LucroProCard />

      {/* Consumo (litros vs km — alimentado pelo Co-pilot) */}
      <ConsumoCard />

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ExpenseChart />
        <MonthlyTrend />
      </div>

      {/* Recent + Expirations */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RecentTransactions />
        <VehicleExpirations />
      </div>
    </DashboardLayout>
  );
};

export default Index;
