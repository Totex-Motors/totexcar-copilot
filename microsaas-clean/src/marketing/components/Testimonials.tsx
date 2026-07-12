import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { TrendingUp, Box, Hexagon } from 'lucide-react';

// --- MOCK DATA ---

const testimonials = [
  {
    company: "São Paulo, SP",
    logo: TrendingUp,
    quote: "Tirei foto do cupom do posto e mandei no WhatsApp. A IA registrou o abastecimento sozinha em segundos. Hoje sei certinho quanto gasto de combustível por mês.",
    name: "Marcelo Andrade",
    role: "Motorista de app",
    image: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    gradient: "from-cyan-600/20 via-purple-500/10 to-teal-500/20"
  },
  {
    company: "Campinas, SP",
    logo: Box,
    quote: "Quase esqueci o IPVA ano passado. Agora o Totex me avisa com antecedência do IPVA, do licenciamento e até da revisão por km. Nunca mais perdi um vencimento.",
    name: "Patrícia Gomes",
    role: "Dona de Onix",
    image: "https://i.pravatar.cc/150?u=a04258a2462d826712d",
    gradient: "from-teal-600/20 via-cyan-500/10 to-purple-500/20"
  },
  {
    company: "Belo Horizonte, MG",
    logo: Hexagon,
    quote: "Mando áudio falando o que paguei e pronto, fica tudo organizado. No fim do mês vejo no gráfico quanto foi de peça, seguro e gasolina. Mudou minha relação com o carro.",
    name: "Rodrigo Pereira",
    role: "Representante comercial",
    image: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    gradient: "from-cyan-500/20 via-cyan-500/10 to-cyan-600/20"
  },
  {
    company: "Curitiba, PR",
    logo: TrendingUp,
    quote: "Por menos de R$11 por mês eu tenho o controle total dos gastos do meu carro. Registrar pelo WhatsApp é tão fácil que finalmente consegui manter o controle em dia.",
    name: "Juliana Martins",
    role: "Dona de HB20",
    image: "https://i.pravatar.cc/150?u=a048581f4e29026701d",
    gradient: "from-emerald-600/20 via-cyan-500/10 to-emerald-500/20"
  }
];

const TestimonialCard = ({ data }: { data: typeof testimonials[0] }) => (
  <div className="relative snap-center w-[85vw] max-w-sm md:w-[400px] md:max-w-none h-auto min-h-[420px] md:h-[450px] flex-shrink-0 rounded-3xl overflow-hidden border border-white/10 bg-[#0A0A0A] group">
    
    {/* Background Gradient Mesh */}
    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40 blur-3xl transition-opacity duration-500", data.gradient)} />
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0A]/80 to-[#0A0A0A]" />

    <div className="relative z-10 h-full p-8 md:p-10 flex flex-col">
      {/* Company Logo */}
      <div className="flex items-center gap-3 mb-10">
        <data.logo className="w-8 h-8 text-white" strokeWidth={2.5} />
        <span className="text-xl font-bold text-white tracking-tight">{data.company}</span>
      </div>

      {/* Quote */}
      <blockquote className="text-lg md:text-xl font-medium text-gray-200 leading-relaxed mb-auto">
        “{data.quote}”
      </blockquote>

      {/* Profile */}
      <div className="flex items-center gap-4 mt-8 pt-8 border-t border-white/5">
        <div className="w-12 h-12 rounded-xl overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
          <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-white font-medium">{data.name}</div>
          <div className="text-sm text-gray-300 md:text-gray-500">{data.role}</div>
        </div>
      </div>
    </div>
  </div>
);

export const Testimonials = () => {
  return (
    <section className="w-full py-16 md:py-32 overflow-hidden relative z-20">

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-8 md:mb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          className="inline-flex items-center rounded-full border border-cyan-500/30 bg-blue-950/10 px-4 py-1.5 mb-6"
        >
          <span className="text-[10px] md:text-xs font-bold tracking-wider text-cyan-400 uppercase">
            Quem usa, aprova
          </span>
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-bold text-white tracking-tight max-w-2xl"
        >
          O que os donos de carro <br />
          falam do Totex
        </motion.h2>
      </div>

      {/* MOBILE: Snap scroll carousel (no auto-ticker, cards never cut off) */}
      <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {testimonials.map((t, i) => (
          <TestimonialCard key={`tm-${i}`} data={t} />
        ))}
      </div>

      {/* DESKTOP: Infinite Scroll Ticker - Constrained Width with Overflow Hidden */}
      <div className="hidden md:block w-full lg:w-[60%] lg:mx-auto relative overflow-hidden">
        {/* Fade Masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-32 bg-gradient-to-r from-[#050505] to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-32 bg-gradient-to-l from-[#050505] to-transparent z-20 pointer-events-none" />

        <div className="flex gap-8 animate-scroll pl-6">
          {/* Set 1 */}
          {testimonials.map((t, i) => (
            <TestimonialCard key={`t1-${i}`} data={t} />
          ))}
          {/* Set 2 (Duplicate for loop) */}
          {testimonials.map((t, i) => (
            <TestimonialCard key={`t2-${i}`} data={t} />
          ))}
          {/* Set 3 (Extra buffer) */}
          {testimonials.map((t, i) => (
            <TestimonialCard key={`t3-${i}`} data={t} />
          ))}
        </div>
      </div>

    </section>
  );
};
