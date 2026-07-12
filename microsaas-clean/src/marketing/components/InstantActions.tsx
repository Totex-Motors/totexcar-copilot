import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Share2, 
  Calendar, 
  Slack,
  Cloud
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- Custom Icons ---

const StarIcon = () => (
  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F1218] border border-cyan-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.1)]">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#star-gradient)" stroke="none" />
      <defs>
        <linearGradient id="star-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// --- Sub-components ---

const ActionRow = ({ 
  icon: Icon, 
  label, 
  colorClass,
  delay 
}: { 
  icon: React.ElementType; 
  label: string; 
  colorClass: string;
  delay: number;
}) => (
  <motion.div 
    initial={{ opacity: 0, x: 10 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.4, delay }}
    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
  >
    <div className={cn("w-8 h-8 rounded-md flex items-center justify-center transition-all", colorClass)}>
      <Icon size={16} className="text-white" />
    </div>
    <span className="text-gray-300 text-sm font-medium group-hover:text-white transition-colors">
      {label}
    </span>
  </motion.div>
);

const BulletPoint = ({ text, delay }: { text: string; delay: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.5, delay }}
    className="flex items-start gap-4"
  >
    <StarIcon />
    <span className="text-gray-300 text-base font-medium leading-relaxed pt-1">
      {text}
    </span>
  </motion.div>
);

export const InstantActions = () => {
  return (
    <section className="w-full py-16 md:py-24 px-4 md:px-6 flex flex-col items-center justify-center relative z-20">

      {/* --- HEADER SECTION (Merged) --- */}
      <div className="flex flex-col items-center justify-center text-center mb-10 md:mb-16 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6 }}
          className="relative p-[1px] rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 mb-8"
        >
          <div className="bg-black rounded-full px-5 py-1.5 relative z-10">
            <span className="text-[11px] md:text-xs font-bold tracking-[0.15em] text-white uppercase">
              Recursos com Inteligência Artificial
            </span>
          </div>
        </motion.div>

        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-[80px] font-bold text-white tracking-tight leading-[1.1] mb-8 max-w-5xl"
        >
          Cuide do seu carro <br className="hidden md:block" />
          direto pelo WhatsApp
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto font-normal leading-relaxed antialiased"
        >
          O TotexCar Co-pilot registra seus gastos, controla manutenções e avisa cada vencimento — sem você precisar abrir planilha.
        </motion.p>
      </div>

      {/* --- CARD CONTAINER --- */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-6xl bg-gradient-to-br from-[#080808] to-[#020202] border border-white/10 rounded-[32px] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shadow-2xl"
      >
        
        {/* --- LEFT COLUMN: TEXT CONTENT --- */}
        <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white tracking-tight leading-[1.15] mb-6">
            Registre tudo <br />
            numa mensagem só
          </h2>

          <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-10 max-w-md">
            Manda um texto, a foto do cupom ou um áudio no WhatsApp — a IA do TotexCar Co-pilot lê, categoriza e lança o gasto sozinha.
          </p>

          <div className="space-y-6">
            <BulletPoint text="Registre o gasto pela foto do cupom" delay={0.2} />
            <BulletPoint text="Atualize o hodômetro por mensagem" delay={0.3} />
            <BulletPoint text="Receba alertas de IPVA, seguro e CNH" delay={0.4} />
          </div>
        </div>

        {/* --- RIGHT COLUMN: VISUAL --- */}
        <div className="relative min-h-[500px] lg:min-h-full bg-[#050505] overflow-hidden flex items-center justify-center p-8">
          
          {/* Background Light Streaks */}
          <div className="absolute inset-0 w-full h-full">
            {/* Blue Streak */}
            <div className="absolute left-1/3 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-cyan-600 to-transparent opacity-60 blur-[2px]" />
            <div className="absolute left-1/3 top-1/4 bottom-1/4 w-[100px] bg-cyan-600/10 blur-[60px]" />
            
            {/* Orange Streak */}
            <div className="absolute right-1/3 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-teal-500 to-transparent opacity-60 blur-[2px]" />
            <div className="absolute right-1/3 top-1/3 bottom-1/3 w-[100px] bg-teal-600/10 blur-[60px]" />
            
            {/* Horizontal Glows */}
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Floating UI Panel */}
          <div className="relative z-10 w-full max-w-[360px]">
            
            {/* Input Field */}
            <div className="mb-4 relative">
              <div className="w-full bg-[#0A0A0A]/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg">
                <div className="w-0.5 h-5 bg-teal-500 animate-pulse" />
                <span className="text-gray-300 md:text-gray-500 text-sm">Ações</span>
              </div>
              {/* Glow under input */}
              <div className="absolute -bottom-4 left-4 right-4 h-4 bg-teal-500/20 blur-xl rounded-full opacity-50" />
            </div>

            {/* Actions List */}
            <div className="bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden">
               {/* Inner Glow */}
               <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
               
               <div className="flex flex-col gap-1">
                  <ActionRow
                    icon={MessageCircle}
                    label="Registrar gasto pela foto do cupom"
                    colorClass="bg-[#0C2D1C] text-[#25D366]" // WhatsApp Green
                    delay={0.2}
                  />
                  <ActionRow
                    icon={Share2}
                    label="Atualizar hodômetro"
                    colorClass="bg-[#2E1810] text-[#FF7A59]"
                    delay={0.3}
                  />
                  <ActionRow
                    icon={Calendar}
                    label="Avisar vencimento do IPVA"
                    colorClass="bg-[#1A2332] text-[#4285F4]"
                    delay={0.4}
                  />
                  <ActionRow
                    icon={Slack}
                    label="Gerar relatório do mês"
                    colorClass="bg-[#2D1F3A] text-[#E01E5A]"
                    delay={0.5}
                  />
                  <ActionRow
                    icon={Cloud}
                    label="Avaliar carro na FIPE"
                    colorClass="bg-[#10243E] text-[#00A1E0]"
                    delay={0.6}
                  />
               </div>
            </div>

          </div>

        </div>

      </motion.div>
    </section>
  );
};
