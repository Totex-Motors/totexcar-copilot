import React, { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  Sidebar,
  MessageCircle,
  Users,
  BarChart2,
  Calendar,
} from "lucide-react";
import { cn } from "../lib/utils";

const ChatBubble = ({
  isAi,
  text,
  delay,
}: {
  isAi: boolean;
  text: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay }}
    className={cn(
      "flex gap-4 max-w-[80%] mb-6",
      isAi ? "self-start" : "self-end flex-row-reverse"
    )}
  >
    <div
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
        isAi ? "bg-transparent" : "bg-green-600 overflow-hidden"
      )}
    >
      {isAi ? (
        <div className="relative w-8 h-8">
          <Sparkles
            className="w-6 h-6 text-cyan-500 absolute top-1 left-1"
            fill="currentColor"
            fillOpacity={0.2}
          />
          <Sparkles className="w-6 h-6 text-teal-500 absolute top-1 left-1 blur-[1px]" />
        </div>
      ) : (
        <MessageCircle size={16} className="text-white" />
      )}
    </div>

    <div
      className={cn(
        "p-4 rounded-2xl text-sm leading-relaxed shadow-lg border",
        isAi
          ? "bg-[#0A0A0A] border-white/10 rounded-tl-none text-gray-300"
          : "bg-[#1A1A1A] border-white/10 rounded-tr-none text-gray-200"
      )}
    >
      {text}
    </div>
  </motion.div>
);

export const InteractiveDemo = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const [typedText, setTypedText] = useState("");
  const fullText = "Nova mensagem no WhatsApp: 'Abasteci 150 reais no Posto Shell'...";

  useEffect(() => {
    if (isInView) {
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex <= fullText.length) {
          setTypedText(fullText.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 60);

      return () => clearInterval(typingInterval);
    }
  }, [isInView]);

  return (
    <section
      ref={containerRef}
      className="relative z-20 w-full py-12 md:py-24 px-4 flex justify-center items-center overflow-hidden"
    >
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-[1100px] h-auto md:h-[750px] rounded-3xl p-px bg-gradient-to-br from-white/20 via-white/[0.05] to-teal-500/20 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]"
      >
        <div className="relative flex h-full w-full overflow-hidden rounded-[23px] bg-gradient-to-br from-[#0a0a0c] to-[#060607]">
          {/* Brilho sutil no topo (efeito vidro) */}
          <div aria-hidden className="pointer-events-none absolute inset-x-12 top-0 z-30 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative z-10 w-72 bg-[#050505] border-r border-white/5 flex flex-col p-6 hidden md:flex">
          <div className="flex gap-2 mb-8">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 overflow-hidden shadow-lg">
              <div className="absolute inset-0 bg-black/20" />
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">
              TotexCar Co-pilot
            </span>
            <Sidebar size={16} className="ml-auto text-gray-600" />
          </div>

          <button className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-gray-200 text-sm font-medium transition-all mb-8 shadow-sm group">
            <Sparkles size={16} className="text-teal-500 group-hover:text-teal-400 transition-colors" />
            Novo Gasto
          </button>

          <div className="flex flex-col gap-2 flex-1">
            {[
              { icon: MessageCircle, label: "Gastos no WhatsApp" },
              { icon: Users, label: "Meu Veículo" },
              { icon: BarChart2, label: "Relatórios de Gastos" },
              { icon: Calendar, label: "Alertas de Vencimento" },
            ].map((item, i) => (
              <div key={i} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-200 hover:bg-white/[0.03] transition-all cursor-pointer">
                <item.icon size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex-1 bg-black/40 flex flex-col">
          <div className="flex-1 p-8 md:p-12 overflow-y-auto flex flex-col">
            <div className="mt-auto">
              <ChatBubble
                isAi={false}
                text="[WhatsApp] Você: Abasteci 150 reais no Posto Shell, hodômetro 48.200 km."
                delay={0.2}
              />
              <ChatBubble
                isAi={true}
                text="Pronto! Registrei R$150 em Combustível no Posto Shell e atualizei o hodômetro para 48.200 km. Sua média este mês está em R$420."
                delay={0.8}
              />
              <ChatBubble
                isAi={false}
                text="Mais uma: paguei 380 reais na revisão. (foto do cupom anexada)"
                delay={1.4}
              />
            </div>
          </div>

          <div className="p-6 md:p-10 pt-0">
            <div className="relative rounded-2xl p-[1px] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/50 via-transparent to-cyan-500/50 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-[#080808] rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs font-medium text-gray-300">
                    <Sparkles size={12} className="text-teal-400" />
                    Assistente no WhatsApp
                    <ChevronDown size={12} className="text-gray-500" />
                  </div>
                </div>
                <div className="min-h-[24px] text-lg text-gray-200 font-light">
                  {typedText}
                  <span className="inline-block w-[2px] h-5 bg-teal-500 ml-0.5 align-middle animate-pulse" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white border border-white/5">Registrar</button>
                    <button className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors">Ver Gastos</button>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#1A1A1A] border border-teal-500/30 text-white text-xs font-medium hover:bg-teal-500/10 transition-all group/btn">
                    <Sparkles size={14} className="text-teal-500" />
                    Ativar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </motion.div>
    </section>
  );
};
