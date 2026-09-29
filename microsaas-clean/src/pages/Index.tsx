import { Navigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WhatsAppConnectCard } from "@/components/WhatsAppConnectCard";
import {
  Car, Coins, ShieldAlert, Wrench, FileText, Radar, Wallet, Fuel, Gauge, ChevronRight,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMonthlyStats, useTotalSpent, useFuelThisMonth } from "@/hooks/useTransactions";
import { useVehicle } from "@/hooks/useAccounts";

const NEON = "#2FE6D6";

// MINHA GARAGEM — home do motorista (versão grátis), no estilo "app de carro" (dark, o carro no centro,
// atalhos grandes pro dia a dia). O detalhe de gastos fica discreto embaixo; o resto abre nas telas.
const Index = () => {
  const { userData, userId, loading } = useCurrentUser();
  const { data: monthlyStats } = useMonthlyStats(userId);
  const { data: totals } = useTotalSpent(userId);
  const { data: fuelMonth } = useFuelThisMonth(userId);
  const { vehicle } = useVehicle(userId);

  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (userData?.role === "dealer") return <Navigate to="/lojista" replace />;

  const nome = (userData?.name || "").split(" ")[0] || "motorista";
  const carro = vehicle ? [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") : null;
  const placa = vehicle?.placa || null;
  const km = vehicle?.hodometro ? `${Number(vehicle.hodometro).toLocaleString("pt-BR")} km` : null;

  const atalhos = [
    { to: "/vale", label: "Quanto vale", sub: "meu carro na FIPE", icon: Coins, destaque: true },
    { to: "/multas", label: "Multas", sub: "consulta e recurso", icon: ShieldAlert },
    { to: "/manutencao", label: "Revisão", sub: "o que já venceu", icon: Wrench },
    { to: "/settings", label: "Documentos", sub: "IPVA · licenciamento", icon: FileText },
    { to: "/servicos", label: "Serviços", sub: "oficina · guincho", icon: Radar },
    { to: "/transactions", label: "Gastos", sub: "tudo do carro", icon: Wallet },
  ];

  return (
    <DashboardLayout>
      {/* bleed pra ocupar a largura toda com fundo escuro (a home vira "app de carro") */}
      <div className="-mx-6 -mt-6 px-4 pt-5 pb-10 min-h-[calc(100vh-4rem)] bg-[#0a0b0f] text-white" style={{ colorScheme: "dark" }}>
        <div className="mx-auto w-full max-w-lg">
          {/* topo: logo + saudação */}
          <div className="flex items-center justify-between">
            <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-9 w-auto object-contain" />
            <span className="text-sm text-neutral-400">Olá, <b className="text-white">{nome}</b> 👋</span>
          </div>

          <WhatsAppConnectCard />

          {/* HERO: o carro em destaque */}
          <div className="mt-4 rounded-3xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(160deg,#10151a,#0a0b0f)", border: `1px solid rgba(47,230,214,.22)`, boxShadow: "0 0 40px rgba(47,230,214,.10)" }}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: NEON }}>
              <Car className="w-4 h-4" /> Minha Garagem
            </div>
            {carro ? (
              <>
                <div className="mt-2 text-2xl font-extrabold leading-tight">{carro}</div>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  {placa && (
                    <span className="inline-flex items-center rounded-lg px-3 py-1.5 font-bold tracking-[0.2em] text-black"
                      style={{ background: NEON, boxShadow: "0 0 14px rgba(47,230,214,.45)" }}>{placa}</span>
                  )}
                  {km && <span className="inline-flex items-center gap-1 text-sm text-neutral-300"><Gauge className="w-4 h-4" /> {km}</span>}
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-xl font-bold">Cadastre seu carro</div>
                <p className="text-sm text-neutral-400 mt-1">Adicione seu veículo pra liberar tudo: vencimentos, revisão, multas e o valor na FIPE.</p>
                <Link to="/settings" className="inline-flex items-center gap-1 mt-3 font-bold text-sm" style={{ color: NEON }}>
                  Cadastrar agora <ChevronRight className="w-4 h-4" />
                </Link>
              </>
            )}
            <Car className="absolute -right-4 -bottom-5 w-32 h-32 opacity-[0.06]" strokeWidth={1} />
          </div>

          {/* ATALHOS grandes */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {atalhos.map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to}
                  className="rounded-2xl p-3 flex flex-col gap-2 active:scale-[0.98] transition"
                  style={{
                    background: a.destaque ? "rgba(47,230,214,.10)" : "#12151b",
                    border: `1px solid ${a.destaque ? "rgba(47,230,214,.45)" : "rgba(255,255,255,.07)"}`,
                  }}>
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: a.destaque ? NEON : "rgba(47,230,214,.12)", color: a.destaque ? "#04110f" : NEON }}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="font-bold text-sm leading-tight">{a.label}</div>
                    <div className="text-[11px] text-neutral-400 leading-tight">{a.sub}</div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* GASTOS — discreto, embaixo */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-300">Resumo do carro</span>
              <Link to="/analytics" className="text-xs text-neutral-500 flex items-center gap-1">ver mais <ChevronRight className="w-3 h-3" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Resumo label="Total gasto" value={brl(totals?.totalExpenses || 0)} icon={<Wallet className="w-4 h-4" />} />
              <Resumo label="Gastos do mês" value={brl(monthlyStats?.expenses || 0)} icon={<Wallet className="w-4 h-4" />} />
              <Resumo label="Combustível (mês)" value={brl(fuelMonth || 0)} icon={<Fuel className="w-4 h-4" />} />
              <Resumo label="Hodômetro" value={km || "—"} icon={<Gauge className="w-4 h-4" />} />
            </div>
          </div>

          <p className="text-center text-[11px] text-neutral-600 mt-8">
            Dica: registre gastos e documentos mandando no WhatsApp do Co-pilot — aparece aqui na hora.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

function Resumo({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#12151b", border: "1px solid rgba(255,255,255,.06)" }}>
      <div className="flex items-center gap-1.5 text-xs text-neutral-400">{icon} {label}</div>
      <div className="text-lg font-bold mt-1 text-white truncate">{value}</div>
    </div>
  );
}

export default Index;
