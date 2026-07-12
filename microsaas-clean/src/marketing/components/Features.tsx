import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Camera, MessageCircle, Mic, Bell, Check
} from 'lucide-react';
import { cn } from '../lib/utils';

const FeatureCard = ({
  title,
  description,
  children,
  className,
  delay = 0,
  bgImage,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  bgImage?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.5, delay }}
    className={cn(
      "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl hover:border-white/30 transition-all p-1 shadow-2xl",
      className
    )}
  >
    <div className="relative h-full flex flex-col rounded-[20px] overflow-hidden bg-black/20">
      {bgImage && (
        <>
          {/* Foto de fundo (transparente, elegante) */}
          <img
            src={bgImage}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
          />
          {/* Degradê escuro só na base p/ manter o título/descrição legíveis */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        </>
      )}
      <div className="relative z-10 h-[180px] md:h-[240px] w-full overflow-hidden flex items-center justify-center">
        {children}
      </div>
      <div className="p-6 md:p-8 mt-auto relative z-10 bg-gradient-to-t from-black/80 to-transparent">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-300 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  </motion.div>
);

const IntegrationsVisual = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <div className="absolute w-32 h-32 md:w-40 md:h-40 bg-teal-600/20 blur-[60px] rounded-full" />
    {/* Anel decorativo: escondido no mobile (estoura a largura do card) */}
    <div className="hidden md:block absolute w-[280px] h-[280px] border border-white/5 rounded-full" />

    {/* MOBILE: ícones numa linha simples, proporcional e legível */}
    <div className="flex md:hidden items-center gap-3">
      <div className="w-12 h-12 rounded-full glass flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.2)]">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600" />
      </div>
      <div className="w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <MessageCircle size={18} className="text-[#25D366]" />
      </div>
      <div className="w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <Mic size={18} className="text-teal-400" />
      </div>
      <div className="w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <Bell size={18} className="text-amber-400" />
      </div>
      <div className="w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <Camera size={18} className="text-cyan-400" />
      </div>
    </div>

    {/* DESKTOP: layout orbital original */}
    <div className="relative z-10 w-16 h-16 rounded-full glass items-center justify-center shadow-[0_0_30px_rgba(20,184,166,0.2)] hidden md:flex">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600" />
    </div>
    <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] animate-[spin_20s_linear_infinite]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <MessageCircle size={18} className="text-[#25D366]" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <Camera size={18} className="text-cyan-400" />
      </div>
      <div className="absolute left-0 top-1/2 -translate-x-4 -translate-y-1/2 w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <Mic size={18} className="text-teal-400" />
      </div>
      <div className="absolute right-0 top-1/2 translate-x-4 -translate-y-1/2 w-10 h-10 glass rounded-full flex items-center justify-center shadow-lg">
        <Bell size={18} className="text-amber-400" />
      </div>
    </div>
  </div>
);

export const Features = () => {
  return (
    <section id="features" className="w-full relative z-10">
      <div className="pb-16 md:pb-32 px-6 max-w-7xl mx-auto pt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <FeatureCard
            title="Tudo pelo WhatsApp"
            description="Mande texto, foto do cupom fiscal ou áudio. A IA lê, categoriza e registra o gasto do seu carro sozinha."
            delay={0.1}
            bgImage="/whatsapp-woman.jpg"
          />

          <FeatureCard
            title="Registro Automático"
            description="É só falar 'abasteci 150 no Shell'. Em segundos o gasto entra na categoria certa, com hodômetro atualizado."
            delay={0.2}
            bgImage="/registro-auto.jpg"
          />

          <FeatureCard
            title="Alertas de Vencimento"
            description="Receba aviso antes de vencer IPVA, licenciamento, seguro e CNH. Nunca mais pague multa por esquecimento."
            delay={0.3}
            bgImage="/alertas.jpg"
          />

          <FeatureCard
            title="Relatórios de Gastos"
            description="Veja quanto seu carro custa por mês e por categoria. Acompanhe a manutenção por km e o histórico completo."
            delay={0.4}
            bgImage="/relatorios.jpg"
          />
        </div>
      </div>
    </section>
  );
};
