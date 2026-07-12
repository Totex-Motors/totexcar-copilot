import React, { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import { Sparkles, Zap, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

// --- VISUAL COMPONENTS ---

const WorkflowVisual = () => (
  <div className="relative w-full h-full bg-[#050505] overflow-hidden rounded-2xl border border-white/5 flex items-center justify-center">
    {/* Left Glow Line */}
    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-500 via-teal-500 to-cyan-500 opacity-80" />
    <div className="absolute left-0 top-1/4 bottom-1/4 w-24 bg-gradient-to-r from-teal-500/20 to-transparent blur-xl" />

    {/* Abstract UI Stack */}
    <div className="relative z-10 w-[280px] flex flex-col gap-4">
      {/* Floating Orb */}
      <div className="mx-auto mb-6 relative">
        <div className="w-12 h-12 rounded-full bg-black border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-black" />
        </div>
      </div>

      {/* Button 1: AI Analyst (Gradient) */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl blur-[2px] opacity-70" />
        <div className="relative bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex items-center justify-center">
          <span className="text-white font-medium tracking-wide">
            Agente no WhatsApp
          </span>
        </div>
      </div>

      {/* Button 2: Workflows */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 flex items-center justify-center text-gray-400">
        <span>Manutenção por km</span>
      </div>

      {/* Button 3: Data Summary */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 flex items-center justify-center text-gray-400">
        <span>Resumo de gastos</span>
      </div>

      {/* Button 4: Ask Questions (Blue Glow) */}
      <div className="relative mt-2 overflow-hidden rounded-xl p-[1px]">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-cyan-400 opacity-50" />
        <div className="relative bg-black/60 backdrop-blur-md rounded-xl p-4 flex items-center justify-center">
          <span className="text-blue-100 font-medium">Tirar dúvidas</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-cyan-500/20 to-transparent pointer-events-none" />
      </div>
    </div>

    {/* Background Mesh */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
  </div>
);

const ChatVisual = () => (
  <div className="relative w-full h-full bg-[#020408] overflow-hidden rounded-2xl border border-white/5 flex flex-col justify-center p-8">
    {/* Bottom Glow */}
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-purple-500" />
    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-600/10 to-transparent blur-2xl" />

    <div className="space-y-6 relative z-10 max-w-[340px] mx-auto w-full">
      {/* Message 1 (Right) */}
      <div className="flex items-start justify-end gap-3">
        <div className="bg-[#151515] border border-white/10 text-gray-300 px-4 py-3 rounded-2xl rounded-tr-sm text-sm shadow-lg">
          Anotei! Abastecimento de R$ 250 registrado em Combustível.
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-900/20 border border-cyan-500/30 flex items-center justify-center">
          <Sparkles size={14} className="text-cyan-400" />
        </div>
      </div>

      {/* Message 2 (Left) */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden border border-white/10">
          <img
            src="https://i.pravatar.cc/150?u=a042581f4e29026024d"
            alt="User"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="bg-[#0A0A0A] border border-cyan-500/30 text-white px-4 py-3 rounded-2xl rounded-tl-sm text-sm shadow-[0_0_15px_rgba(59,130,246,0.1)]">
          Coloca também o pneu novo, R$ 480
        </div>
      </div>

      {/* Message 3 (Right - Active) */}
      <div className="flex items-start justify-end gap-3">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-2xl rounded-tr-sm blur-[2px] opacity-40" />
          <div className="relative bg-[#0B1221] border border-cyan-500/50 text-blue-100 px-4 py-3 rounded-2xl rounded-tr-sm text-sm">
            Pronto! Algo mais?
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/20 to-teal-900/20 border border-teal-500/30 flex items-center justify-center">
          <Zap size={14} className="text-teal-400" />
        </div>
      </div>
    </div>
  </div>
);

const AnalyticsVisual = () => (
  <div className="relative w-full h-full bg-[#050505] overflow-hidden rounded-2xl border border-white/5 flex items-center justify-center">
    {/* Background Gradient */}
    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[80px] rounded-full" />
    <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full" />

    <div className="relative z-10 w-[300px] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm font-medium text-gray-300">Gastos do mês</div>
        <div className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
          Últimos 7 dias
        </div>
      </div>

      {/* Bar Chart Mockup */}
      <div className="flex items-end justify-between h-[140px] gap-2">
        {[40, 70, 45, 90, 65, 85, 50].map((h, i) => (
          <div
            key={i}
            className="w-full bg-white/5 rounded-t-sm relative group overflow-hidden"
            style={{ height: `${h}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-600 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
            {i === 3 && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-teal-500 shadow-[0_0_10px_#F97316]" />
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          Combustível
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-teal-500" />
          Manutenção
        </div>
      </div>
    </div>
  </div>
);

// --- CARD COMPONENT ---

interface CardProps {
  i: number;
  title: string;
  description: string;
  features: string[];
  Visual: React.FC;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}

const Card: React.FC<CardProps> = ({
  i,
  title,
  description,
  features,
  Visual,
  progress,
  range,
  targetScale,
}) => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "start start"],
  });

  const scale = useTransform(progress, range, [1, targetScale]);
  const opacity = useTransform(progress, range, [1, 0.3]); // Fade out as it moves up/gets covered

  // Custom star icon for bullets
  const StarBullet = () => (
    <div className="relative w-5 h-5 flex-shrink-0 mt-0.5">
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <defs>
          <linearGradient
            id={`star-grad-${i}`}
            x1="0"
            y1="0"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
        <path
          d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
          fill={`url(#star-grad-${i})`}
        />
      </svg>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="min-h-screen md:h-screen flex items-center justify-center md:sticky md:top-0 py-8 md:py-0"
    >
      <motion.div
        style={{ scale, opacity, top: `calc(-5% + ${i * 25}px)` }}
        className="relative flex flex-col md:flex-row gap-8 md:gap-12 w-full max-w-6xl h-auto md:h-[550px] bg-gradient-to-br from-[#0A0A0A] to-[#050505] border border-white/10 rounded-[32px] p-6 md:p-12 shadow-2xl overflow-hidden origin-top"
      >
        {/* Layout Switch based on index (Alternating) */}
        <div
          className={cn(
            "flex flex-col md:flex-row w-full h-auto md:h-full gap-8 md:gap-12",
            i % 2 === 0 ? "" : "md:flex-row-reverse"
          )}
        >
          {/* Visual Side */}
          <div className="flex-1 w-full h-[280px] md:h-full md:min-h-[250px] rounded-2xl overflow-hidden">
            <Visual />
          </div>

          {/* Content Side */}
          <div className="flex-1 flex flex-col justify-start md:justify-center">
            <h3 className="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6 leading-tight">
              {title}
            </h3>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-6 md:mb-8">
              {description}
            </p>
            <ul className="space-y-3 md:space-y-4">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <StarBullet />
                  <span className="text-gray-300 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            <button
              className="mt-6 md:mt-10 w-fit flex items-center gap-2 text-white font-medium border-b border-teal-500 pb-1 hover:text-teal-500 transition-colors group"
              name="learn-more"
            >
              Saiba mais
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const projects = [
  {
    title: "Controle de km e manutenção",
    description:
      "Acompanhe a quilometragem do carro e saiba exatamente quando fazer cada revisão e troca de peça.",
    features: [
      "Hodômetro sempre atualizado",
      "Lembretes de revisão por km",
      "Histórico de peças e serviços",
    ],
    Visual: WorkflowVisual,
  },
  {
    title: "Agente de IA no WhatsApp",
    description:
      "Mande texto, foto do cupom ou áudio. A IA lê, categoriza e registra o gasto sozinha — é só conversar.",
    features: [
      "Entende foto, texto e áudio",
      "Lança o gasto na hora",
      "Tira dúvidas sobre seus gastos",
    ],
    Visual: ChatVisual,
  },
  {
    title: "Relatórios e análises do carro",
    description:
      "Veja para onde vai o dinheiro do seu carro e tome decisões melhores, com relatórios claros e atualizados.",
    features: [
      "Gastos por categoria",
      "Custo por km rodado",
      "Relatório mensal automático",
    ],
    Visual: AnalyticsVisual,
  },
];

export const StackedCards = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <section className="py-12 md:py-24 relative z-20">
      {/* Header for the section */}
      <div className="max-w-7xl mx-auto px-6 mb-12 md:mb-24 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Tudo que seu carro precisa <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-teal-500">
            num único app
          </span>
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Recursos pensados para o dono de carro brasileiro: controle de gastos,
          manutenção, vencimentos e muito mais — sem complicação.
        </p>
      </div>

      {/* Scroll Container */}
      <div ref={containerRef} className="relative px-4 md:px-6">
        {projects.map((project, i) => {
          const targetScale = 1 - (projects.length - i) * 0.05;
          return (
            <Card
              key={i}
              i={i}
              {...project}
              progress={scrollYProgress}
              range={[i * 0.25, 1]}
              targetScale={targetScale}
            />
          );
        })}
      </div>
    </section>
  );
};
