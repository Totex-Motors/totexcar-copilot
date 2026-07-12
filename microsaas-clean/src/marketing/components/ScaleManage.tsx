import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  GitBranch,
  BarChart2,
  Settings,
  Puzzle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Slack,
  Mail,
  Database,
  Zap,
  Cpu,
} from "lucide-react";
import { cn } from "../lib/utils";

// --- DASHBOARD COMPONENTS ---

const Sidebar = ({ activeIndex }: { activeIndex: number }) => (
  <div className="w-64 bg-[#080808] border-r border-white/5 flex flex-col p-4 flex-shrink-0 hidden md:flex">
    {/* Window Controls */}
    <div className="flex gap-2 mb-6 px-2">
      <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
      <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
      <div className="w-3 h-3 rounded-full bg-[#28C840]" />
    </div>

    {/* User Profile */}
    <div className="flex items-center gap-3 mb-6 px-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-black p-[1px]">
        <div className="w-full h-full rounded-full bg-black/40 backdrop-blur-sm" />
      </div>
      <span className="text-white font-medium">TotexCar Co-pilot</span>
      <div className="ml-auto border border-white/10 rounded p-1">
        <div className="w-3 h-3 border-2 border-gray-500 rounded-sm" />
      </div>
    </div>

    {/* Active Context Button */}
    <div className="bg-[#111] border border-white/10 rounded-lg p-3 mb-6 flex items-center gap-3 shadow-inner">
      <div className="text-cyan-500">
        <Plus size={16} />
      </div>
      <span className="text-sm text-gray-300">Novo gasto</span>
    </div>

    {/* Navigation */}
    <nav className="space-y-1">
      {[
        { icon: LayoutDashboard, label: "Painel", active: false },
        { icon: MessageSquare, label: "WhatsApp", active: false },
        { icon: GitBranch, label: "Manutenção", active: activeIndex === 2 },
        { icon: BarChart2, label: "Relatórios", active: activeIndex === 0 },
        { icon: Puzzle, label: "Meu Veículo", active: activeIndex === 1 },
        { icon: Settings, label: "Ajustes", active: false },
      ].map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-default",
            item.active ? "text-white bg-white/5" : "text-gray-500"
          )}
        >
          <item.icon size={18} />
          {item.label}
        </div>
      ))}
    </nav>
  </div>
);

// --- VIEW 1: ANALYTICS ---

const MetricCard = ({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) => (
  <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-5 flex flex-col justify-between h-32 relative overflow-hidden group">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <span className="text-gray-400 text-xs font-medium z-10">{label}</span>
    <div className="z-10">
      <div className="text-2xl font-semibold text-white mb-1">{value}</div>
      <div
        className={cn(
          "text-xs flex items-center gap-1",
          trendUp ? "text-emerald-400" : "text-emerald-400"
        )}
      >
        {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {trend}
      </div>
    </div>
  </div>
);

const AnalyticsView = () => (
  <div className="absolute inset-0 p-4 md:p-8 flex flex-col bg-[#050505]">
    <h3 className="text-lg font-medium text-white mb-4 md:mb-6">
      Relatórios e análises
    </h3>

    {/* Metrics Grid */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-8">
      <MetricCard
        label="Gasto no mês"
        value="R$ 1.842"
        trend="-8,5%"
        trendUp={false}
      />
      <MetricCard
        label="Combustível"
        value="R$ 980"
        trend="-3,1%"
        trendUp={false}
      />
      <MetricCard
        label="Custo por km"
        value="R$ 0,62"
        trend="-0,04"
        trendUp={false}
      />
      <MetricCard
        label="Km rodados"
        value="1.420"
        trend="+120"
        trendUp={true}
      />
    </div>

    {/* Leaderboard */}
    <div className="flex-1 bg-gradient-to-br from-[#0A0A0A] to-[#050505] border border-white/5 rounded-xl p-6 overflow-hidden">
      <h4 className="text-sm font-medium text-gray-300 mb-6">
        Gastos por categoria
      </h4>

      <div className="w-full">
        <div className="grid grid-cols-4 text-xs text-gray-500 pb-4 border-b border-white/5">
          <div>Categoria</div>
          <div>Lançamentos</div>
          <div className="hidden sm:block">Valor no mês</div>
          <div>% do total</div>
        </div>

        <div className="space-y-4 mt-4">
          {[
            { name: "Combustível", conv: "12", time: "R$ 980", sat: 53 },
            { name: "Revisão", conv: "1", time: "R$ 420", sat: 23 },
            { name: "Pneus", conv: "1", time: "R$ 480", sat: 26 },
            { name: "Seguro", conv: "1", time: "R$ 320", sat: 17 },
          ].map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-4 text-sm items-center group"
            >
              <div className="text-white truncate pr-2">{row.name}</div>
              <div className="text-gray-400">{row.conv}</div>
              <div className="text-gray-400 hidden sm:block">{row.time}</div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-16 sm:w-24 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${row.sat}%` }}
                  />
                </div>
                <span className="text-gray-400 text-xs hidden sm:inline">
                  {row.sat}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// --- VIEW 2: INTEGRATIONS ---

const IntegrationCard = ({
  icon: Icon,
  name,
  desc,
  count,
  color,
  connected,
}: any) => (
  <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-5 flex flex-col gap-4 group hover:border-white/10 transition-colors">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center bg-white/5",
            color
          )}
        >
          <Icon size={20} className="text-white" />
        </div>
        <span className="font-medium text-white">{name}</span>
      </div>
    </div>
    <p className="text-xs text-gray-400 leading-relaxed min-h-[32px]">{desc}</p>
    <div className="flex items-center justify-between mt-auto pt-2">
      <span className="text-xs text-gray-500">{count}</span>
      <button
        className={cn(
          "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
          connected
            ? "bg-white/5 text-gray-300 hover:bg-white/10"
            : "bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20"
        )}
      >
        {connected ? "Em dia" : "Vence logo"}
      </button>
    </div>
  </div>
);

const IntegrationsView = () => (
  <div className="absolute inset-0 p-4 md:p-8 flex flex-col bg-[#050505]">
    <h3 className="text-lg font-medium text-white mb-4 md:mb-6">
      Vencimentos do veículo
    </h3>

    {/* Filters */}
    <div className="flex gap-2 mb-4 md:mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {["Todos", "Documentos", "Seguro", "Manutenção", "CNH"].map(
        (filter, i) => (
          <button
            key={i}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
              i === 0
                ? "bg-white/10 border-white/10 text-white"
                : "bg-transparent border-white/5 text-gray-500 hover:text-gray-300"
            )}
          >
            {filter}
          </button>
        )
      )}
    </div>

    {/* Grid */}
    <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2">
      <IntegrationCard
        icon={Database}
        name="IPVA"
        desc="Imposto anual do veículo"
        count="Vence em 12/03"
        color="bg-[#4A154B]"
        connected={true}
      />
      <IntegrationCard
        icon={Mail}
        name="Licenciamento"
        desc="Renovação do documento do carro"
        count="Vence em 30/09"
        color="bg-[#EA4335]"
        connected={true}
      />
      <IntegrationCard
        icon={Database}
        name="Seguro"
        desc="Renovação da apólice anual"
        count="Vence em 18 dias"
        color="bg-[#FF7A59]"
        connected={false}
      />
      <IntegrationCard
        icon={Database}
        name="CNH"
        desc="Validade da sua habilitação"
        count="Vence em 2027"
        color="bg-[#000000]"
        connected={true}
      />
      <IntegrationCard
        icon={Zap}
        name="Revisão"
        desc="Próxima revisão por quilometragem"
        count="Faltam 800 km"
        color="bg-[#FF4F00]"
        connected={false}
      />
      <IntegrationCard
        icon={Cpu}
        name="Pneus"
        desc="Troca recomendada por desgaste"
        count="Última: 42.000 km"
        color="bg-[#10A37F]"
        connected={true}
      />
    </div>
  </div>
);

// --- VIEW 3: WORKFLOWS ---

const WorkflowsView = () => (
  <div className="absolute inset-0 p-4 md:p-8 flex flex-col bg-[#050505]">
    <div className="flex items-center justify-between mb-4 md:mb-6">
      <h3 className="text-lg font-medium text-white">Como a IA registra</h3>
      <button
        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors"
        name="new-workflow"
      >
        <Plus size={14} /> Novo gasto
      </button>
    </div>

    <div className="flex-1 bg-[#0A0A0A] border border-white/5 rounded-xl relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Nodes */}
      <div className="absolute inset-0 flex items-center justify-center scale-[0.45] sm:scale-75 md:scale-100 origin-center">
        {/* Start Node */}
        <div className="absolute left-12 top-1/2 -translate-y-1/2 w-48 bg-[#111] border border-white/10 rounded-xl p-4 shadow-xl z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Zap size={16} />
            </div>
            <span className="text-sm font-medium text-white">Mensagem no WhatsApp</span>
          </div>
          <div className="text-xs text-gray-500">Foto, texto ou áudio</div>
        </div>

        {/* Connection 1 */}
        <svg className="absolute inset-0 pointer-events-none z-0">
          <path
            d="M 240 250 C 300 250, 300 250, 360 250"
            stroke="#333"
            strokeWidth="2"
            fill="none"
          />
        </svg>

        {/* Action Node */}
        <div className="absolute left-[360px] top-1/2 -translate-y-1/2 w-48 bg-[#111] border border-teal-500/30 rounded-xl p-4 shadow-[0_0_30px_rgba(203,52,42,0.1)] z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded bg-teal-500/20 flex items-center justify-center text-teal-400">
              <Cpu size={16} />
            </div>
            <span className="text-sm font-medium text-white">IA lê e categoriza</span>
          </div>
          <div className="text-xs text-gray-500">Valor, data e categoria</div>
        </div>

        {/* Connection 2 Split */}
        <svg className="absolute inset-0 pointer-events-none z-0">
          <path
            d="M 550 250 C 600 250, 600 180, 650 180"
            stroke="#333"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M 550 250 C 600 250, 600 320, 650 320"
            stroke="#333"
            strokeWidth="2"
            fill="none"
          />
        </svg>

        {/* End Nodes */}
        <div className="absolute left-[650px] top-[140px] w-48 bg-[#111] border border-white/10 rounded-xl p-4 shadow-xl z-10 opacity-60">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center text-green-400">
              <Slack size={16} />
            </div>
            <span className="text-sm font-medium text-white">Gasto registrado</span>
          </div>
        </div>

        <div className="absolute left-[650px] top-[280px] w-48 bg-[#111] border border-white/10 rounded-xl p-4 shadow-xl z-10 opacity-60">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Mail size={16} />
            </div>
            <span className="text-sm font-medium text-white">Relatório atualizado</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

const slides = [
  {
    id: "analytics",
    title: "Relatórios",
    description:
      "Veja gastos por categoria, custo por km e o total do mês num painel claro — para decidir melhor.",
    Component: AnalyticsView,
  },
  {
    id: "integrations",
    title: "Vencimentos",
    description:
      "IPVA, licenciamento, seguro, revisão e CNH num só lugar, com alerta antes de cada vencimento.",
    Component: IntegrationsView,
  },
  {
    id: "workflows",
    title: "Registro por IA",
    description:
      "Mande a foto do cupom, um texto ou um áudio no WhatsApp e a IA registra o gasto automaticamente.",
    Component: WorkflowsView,
  },
];

export const ScaleManage = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-12 md:py-24 relative overflow-hidden z-20">
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-12 relative z-20">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
            Gastos, vencimentos e relatórios <br />
            num painel só
          </h2>
        </div>

        {/* Dashboard Window */}
        <div className="relative w-full max-w-6xl h-[480px] sm:h-auto sm:aspect-[16/9] md:aspect-[16/8] bg-gradient-to-br from-[#050505] to-[#080808] border border-white/10 rounded-3xl flex overflow-hidden shadow-2xl z-10">
          <Sidebar activeIndex={activeIndex} />
          <div className="flex-1 relative bg-[#050505] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {React.createElement(slides[activeIndex].Component)}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Ambient Glows */}
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-teal-500/10 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-full h-32 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        </div>

        {/* Progress Indicators */}
        <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "space-y-4 cursor-pointer group transition-opacity duration-300",
                activeIndex === index
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-60"
              )}
            >
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                {activeIndex === index ? (
                  <motion.div
                    className="h-full bg-teal-500"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 7, ease: "linear" }}
                  />
                ) : (
                  <div
                    className={cn(
                      "h-full bg-teal-500 w-0",
                      index < activeIndex && "w-full"
                    )}
                  />
                )}
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">{slide.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {slide.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
