import { motion } from "framer-motion";
import {
  Database,
  Cloud,
  Calendar,
  Mail,
  MessageSquare,
  HardDrive,
  Globe,
  Zap,
  Layout,
  Box,
  Server,
  BarChart2,
  GitBranch,
  Banknote,
  Car,
  Bell,
  RefreshCw,
  Gift,
  Fuel,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";

// --- Icon Data ---

const iconsRow1 = [
  { icon: Zap, label: "Combustível", color: "text-[#E01E5A]", bg: "bg-[#E01E5A]/10" },
  { icon: Database, label: "IPVA", color: "text-[#FF7A59]", bg: "bg-[#FF7A59]/10" },
  { icon: Cloud, label: "Seguro", color: "text-[#00A1E0]", bg: "bg-[#00A1E0]/10" },
  { icon: Calendar, label: "Licenciamento", color: "text-[#4285F4]", bg: "bg-[#4285F4]/10" },
  { icon: Server, label: "Revisão", color: "text-[#EA4335]", bg: "bg-[#EA4335]/10" },
  { icon: MessageSquare, label: "WhatsApp", color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
  { icon: Globe, label: "FIPE", color: "text-white", bg: "bg-white/10" },
  { icon: Box, label: "Multas", color: "text-[#F24E1E]", bg: "bg-[#F24E1E]/10" },
  { icon: Layout, label: "Pneus", color: "text-[#0079BF]", bg: "bg-[#0079BF]/10" },
  { icon: Mail, label: "CNH", color: "text-[#2D8CFF]", bg: "bg-[#2D8CFF]/10" },
];

const iconsRow2 = [
  { icon: HardDrive, label: "Peças", color: "text-[#FFD04B]", bg: "bg-[#FFD04B]/10" },
  { icon: BarChart2, label: "Relatórios", color: "text-[#4285F4]", bg: "bg-[#4285F4]/10" },
  { icon: GitBranch, label: "Manutenção por km", color: "text-[#1DA1F2]", bg: "bg-[#1DA1F2]/10" },
  { icon: Banknote, label: "PIX", color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/10" },
  { icon: Car, label: "Meu Veículo", color: "text-[#7F56D9]", bg: "bg-[#7F56D9]/10" },
  { icon: Bell, label: "Alertas", color: "text-[#FF4F00]", bg: "bg-[#FF4F00]/10" },
  { icon: RefreshCw, label: "Recompra", color: "text-[#00C5F7]", bg: "bg-[#00C5F7]/10" },
  { icon: Gift, label: "Indique e Ganhe", color: "text-[#0061FF]", bg: "bg-[#0061FF]/10" },
  { icon: Fuel, label: "Abastecimento", color: "text-[#F80000]", bg: "bg-[#F80000]/10" },
  { icon: Wrench, label: "Serviços", color: "text-[#61DAFB]", bg: "bg-[#61DAFB]/10" },
];

const IconCard = ({
  icon: Icon,
  label,
  color,
  bg,
}: {
  icon: any;
  label: string;
  color: string;
  bg: string;
}) => (
  <div className="h-16 md:h-20 flex-shrink-0 inline-flex items-center justify-center gap-2.5 md:gap-3 rounded-2xl bg-[#0A0A0A] border border-white/10 px-4 md:px-5 hover:border-white/20 hover:bg-white/5 transition-all duration-300 group">
    <div
      className={cn(
        "w-9 h-9 md:w-10 md:h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
        bg
      )}
    >
      <Icon size={20} className={cn(color)} />
    </div>
    <span className="whitespace-nowrap text-gray-200 text-sm font-medium">
      {label}
    </span>
  </div>
);

export const IntegrationsTicker = () => {
  return (
    <section className="relative w-full py-16 md:py-32 overflow-hidden flex flex-col items-center z-20">
      {/* --- BACKGROUND ORB --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
        {/* Core Glow */}
        <div className="w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 blur-[80px] opacity-20" />
        {/* Inner Ring (Simulating the planet edge) */}
        <div className="absolute inset-0 rounded-full border-[2px] border-white/5 opacity-20 blur-sm" />
        {/* Secondary Glow */}
        <div className="absolute top-1/4 left-1/4 w-[200px] h-[200px] bg-cyan-500/30 blur-[60px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] bg-teal-500/30 blur-[60px] rounded-full" />
      </div>

      {/* --- HEADER --- */}
      <div className="relative z-10 flex flex-col items-center text-center mb-12 md:mb-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          className="relative p-[1px] rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mb-6"
        >
          <div className="bg-black rounded-full px-5 py-1.5">
            <span className="text-[10px] md:text-xs font-bold tracking-[0.15em] text-white uppercase">
              Tudo num lugar só
            </span>
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-bold text-white tracking-tight"
        >
          Tudo que seu carro <br />
          precisa, num lugar só
        </motion.h2>
      </div>

      {/* --- TICKER SECTION --- */}
      <div className="relative w-full z-10 flex flex-col gap-6 md:gap-8">
        {/* Fade Masks: estreitos no mobile (12) p/ não apagar os cards; 25% no desktop */}
        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-1/4 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-1/4 bg-gradient-to-l from-[#050505] via-[#050505]/80 to-transparent z-20 pointer-events-none" />

        {/* Row 1: Left Scroll */}
        <div className="flex w-full overflow-hidden">
          <div className="flex gap-6 md:gap-8 animate-scroll min-w-full px-4">
            {[...iconsRow1, ...iconsRow1, ...iconsRow1].map((item, i) => (
              <IconCard key={`r1-${i}`} {...item} />
            ))}
          </div>
        </div>

        {/* Row 2: Right Scroll */}
        <div className="flex w-full overflow-hidden">
          <div className="flex gap-6 md:gap-8 animate-scroll-reverse min-w-full px-4">
            {[...iconsRow2, ...iconsRow2, ...iconsRow2].map((item, i) => (
              <IconCard key={`r2-${i}`} {...item} />
            ))}
          </div>
        </div>
      </div>

      {/* --- FOOTER CTA --- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 mt-16"
      >
        <button
          className="px-8 py-3 rounded-full bg-[#0A0A0A] border border-white/10 text-white text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-all"
          name="explore-all"
        >
          Ver todos os recursos
        </button>
      </motion.div>
    </section>
  );
};
