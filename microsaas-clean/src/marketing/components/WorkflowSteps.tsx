import React from 'react';
import { motion } from 'framer-motion';
import { Zap, MessageSquare, Check, Slack, Calendar, Mail, Database, Box, Hexagon } from 'lucide-react';

// --- VISUALS ---

const Step1Visual = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Background Glow */}
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/20 via-transparent to-teal-600/20 blur-2xl" />
    
    <div className="relative z-10 flex flex-col gap-6">
      {/* Trigger Node */}
      <div className="bg-[#111] border border-white/10 rounded-xl p-3 px-5 flex items-center gap-3 shadow-lg w-48">
        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-sm text-gray-300">Você manda</span>
      </div>

      {/* Dotted Line */}
      <div className="h-8 border-l-2 border-dashed border-white/10 ml-8" />

      {/* Action Node */}
      <div className="bg-[#111] border border-white/10 rounded-xl p-3 px-5 flex items-center gap-3 shadow-lg w-48 ml-4">
        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
          <MessageSquare size={14} className="text-white" />
        </div>
        <span className="text-sm text-gray-300">A IA registra</span>
      </div>
    </div>
  </div>
);

const Step2Visual = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Background Glow */}
    <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/30 via-transparent to-cyan-500/10 blur-2xl" />
    
    <div className="relative z-10 grid grid-cols-3 gap-4">
      {[Slack, Calendar, Mail, Database, Box, Hexagon].map((Icon, i) => (
        <div 
          key={i}
          className="w-12 h-12 rounded-xl bg-[#151515] border border-white/10 flex items-center justify-center shadow-lg hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors duration-300"
        >
          <Icon size={20} className="text-gray-400" />
        </div>
      ))}
    </div>
  </div>
);

const Step3Visual = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    {/* Background Glow */}
    <div className="absolute inset-0 bg-gradient-to-bl from-teal-600/20 via-transparent to-cyan-600/20 blur-2xl" />
    
    {/* Check Button */}
    <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
        <div className="relative w-24 h-24 bg-[#0A0A0A] border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                <Check size={24} className="text-white" strokeWidth={3} />
            </div>
        </div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export const WorkflowSteps = () => {
  return (
    <section className="w-full py-16 md:py-32 relative z-20">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-12 md:mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-950/10 px-4 py-1.5 mb-6"
          >
            <span className="text-[10px] md:text-xs font-bold tracking-wider text-teal-400 uppercase">
              Como funciona
            </span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-white tracking-tight"
          >
Controle os gastos do carro <br />
            em poucos passos
          </motion.h2>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Step 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ delay: 0.2 }}
            className="group flex flex-col"
          >
            <div className="h-[300px] w-full bg-[#080808] border border-white/10 rounded-2xl overflow-hidden mb-6 relative group-hover:border-white/20 transition-colors">
              <Step1Visual />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">1. Você manda no WhatsApp</h3>
            <p className="text-gray-400 leading-relaxed">
              Mande a foto do cupom do posto, um áudio ou só um texto dizendo o que pagou.
            </p>
          </motion.div>

          {/* Step 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ delay: 0.3 }}
            className="group flex flex-col"
          >
            <div className="h-[300px] w-full bg-[#080808] border border-white/10 rounded-2xl overflow-hidden mb-6 relative group-hover:border-white/20 transition-colors">
              <Step2Visual />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">2. A IA lê e registra</h3>
            <p className="text-gray-400 leading-relaxed">
              A inteligência artificial entende a mensagem, lança o gasto na categoria certa e atualiza a quilometragem do carro.
            </p>
          </motion.div>

          {/* Step 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ delay: 0.4 }}
            className="group flex flex-col"
          >
            <div className="h-[300px] w-full bg-[#080808] border border-white/10 rounded-2xl overflow-hidden mb-6 relative group-hover:border-white/20 transition-colors">
              <Step3Visual />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">3. Você acompanha tudo</h3>
            <p className="text-gray-400 leading-relaxed">
              Veja gastos, gráficos e relatórios no painel e receba alertas de IPVA, seguro e revisão antes de vencer.
            </p>
          </motion.div>

        </div>

      </div>
    </section>
  );
};
