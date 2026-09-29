import { Navigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Car, Coins, ShieldAlert, Wrench, FileText, Radar, Wallet, Fuel, Gauge, ChevronRight,
  AlertTriangle, MessageCircle, ShieldCheck, Stamp, ClipboardCheck,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMonthlyStats, useTotalSpent, useFuelThisMonth } from "@/hooks/useTransactions";
import { useVehicle } from "@/hooks/useAccounts";

const NEON = "#2FE6D6";
const WA = "5511963786699";

// dias até uma data YYYY-MM-DD (negativo = venceu)
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(y, m - 1, d); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

// MINHA GARAGEM — home do motorista (versão grátis) no estilo "app de carro": dark, carro no centro,
// aviso do que vence, atalhos grandes, o Co-pilot e parceiros. Gastos discretos embaixo.
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

  // próximo vencimento (o mais urgente entre licenciamento/IPVA/seguro) — dado real do veículo
  const vencs = [
    { tipo: "Licenciamento", d: daysUntil((vehicle as any)?.licenciamento_vencimento) },
    { tipo: "IPVA", d: daysUntil((vehicle as any)?.ipva_vencimento) },
    { tipo: "Seguro", d: daysUntil((vehicle as any)?.seguro_vencimento) },
  ].filter((x) => x.d != null).sort((a, b) => (a.d as number) - (b.d as number));
  const prox = vencs[0];
  const alerta = prox && (prox.d as number) <= 60
    ? {
        tipo: prox.tipo,
        txt: (prox.d as number) < 0 ? `${prox.tipo} venceu há ${Math.abs(prox.d as number)} dia(s)`
          : (prox.d as number) === 0 ? `${prox.tipo} vence hoje`
          : `${prox.tipo} vence em ${prox.d} dia(s)`,
        urgente: (prox.d as number) <= 7,
      }
    : null;

  const atalhos = [
    { to: "/vale", label: "Quanto vale", sub: "meu carro na FIPE", icon: Coins, destaque: true },
    { to: "/multas", label: "Multas", sub: "consulta e recurso", icon: ShieldAlert },
    { to: "/manutencao", label: "Revisão", sub: "o que já venceu", icon: Wrench },
    { to: "/settings", label: "Documentos", sub: "IPVA · licenciamento", icon: FileText },
    { to: "/servicos", label: "Serviços", sub: "oficina · guincho", icon: Radar },
    { to: "/transactions", label: "Gastos", sub: "tudo do carro", icon: Wallet },
  ];

  const parceiros = [
    { label: "Seguro", sub: "cotação rápida", icon: ShieldCheck },
    { label: "Despachante", sub: "transferência", icon: Stamp },
    { label: "Vistoria", sub: "cautelar", icon: ClipboardCheck },
  ];

  return (
    <DashboardLayout>
      <div className="-mx-6 -mt-6 px-4 pt-5 pb-10 min-h-[calc(100vh-4rem)] bg-[#0a0b0f] text-white" style={{ colorScheme: "dark" }}>
        <div className="mx-auto w-full max-w-lg">
          {/* topo */}
          <div className="flex items-center justify-between">
            <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-9 w-auto object-contain" />
            <span className="text-sm text-neutral-400">Olá, <b className="text-white">{nome}</b> 👋</span>
          </div>

          {/* AVISO do que vence (dado real) */}
          {alerta && (
            <Link to="/settings" className="mt-4 flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] transition"
              style={{ background: alerta.urgente ? "rgba(224,100,85,.12)" : "rgba(224,149,74,.12)", border: `1px solid ${alerta.urgente ? "rgba(224,100,85,.4)" : "rgba(224,149,74,.4)"}` }}>
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
                style={{ background: alerta.urgente ? "rgba(224,100,85,.18)" : "rgba(224,149,74,.18)", color: alerta.urgente ? "#e06455" : "#e0954a" }}>
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm">{alerta.txt}</div>
                <div className="text-xs text-neutral-400">Toque pra ver e resolver</div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-500 shrink-0" />
            </Link>
          )}

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
                <Link key={a.to} to={a.to} className="rounded-2xl p-3 flex flex-col gap-2 active:scale-[0.98] transition"
                  style={{ background: a.destaque ? "rgba(47,230,214,.10)" : "#12151b", border: `1px solid ${a.destaque ? "rgba(47,230,214,.45)" : "rgba(255,255,255,.07)"}` }}>
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

          {/* CO-PILOT no WhatsApp */}
          <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Oi! Quero cuidar do meu carro com o Co-pilot 🚗")}`} target="_blank" rel="noreferrer"
            className="mt-4 flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] transition"
            style={{ background: "linear-gradient(120deg,#0E2A22,#123c30)", border: "1px solid #1c4636" }}>
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style={{ background: "#1FA855", color: "#04110f" }}>
              <MessageCircle className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-sm">Fale com o Co-pilot</div>
              <div className="text-xs text-[#A9CBBB]">Registre gasto, tire foto do documento, pergunte do carro — tudo no WhatsApp.</div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#7fae99] shrink-0" />
          </a>

          {/* GASTOS — discreto */}
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

          {/* PARCEIROS */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-300">Parceiros com desconto</span>
              <Link to="/servicos" className="text-xs text-neutral-500 flex items-center gap-1">ver todos <ChevronRight className="w-3 h-3" /></Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {parceiros.map((p) => {
                const Icon = p.icon;
                return (
                  <Link key={p.label} to="/servicos" className="rounded-2xl p-3 flex flex-col gap-2 active:scale-[0.98] transition"
                    style={{ background: "#12151b", border: "1px solid rgba(255,255,255,.06)" }}>
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: "rgba(47,230,214,.12)", color: NEON }}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="font-bold text-[13px] leading-tight">{p.label}</div>
                      <div className="text-[11px] text-neutral-400 leading-tight">{p.sub}</div>
                    </div>
                  </Link>
                );
              })}
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
