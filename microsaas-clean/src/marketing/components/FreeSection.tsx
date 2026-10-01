import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GradientBorder } from "./ui/GradientBorder";
import { RollingText } from "./ui/RollingText";

// GRÁTIS — sem tabela de preços. Só a verdade: R$ 0, sem mensalidade, sem cartão.
export const FreeSection = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-3xl mx-auto text-center">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-4">
        Seu Co-pilot é grátis.
      </motion.h2>
      <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg mb-10">
        Porque cuidar melhor do seu carro não deveria começar com uma assinatura.
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
        className="rounded-3xl border border-teal-500/30 bg-[#0a0a0a] p-8 md:p-10 shadow-[0_0_60px_rgba(20,184,166,0.12)]">
        <div className="flex items-baseline justify-center gap-2 mb-6">
          <span className="text-6xl md:text-7xl font-bold text-white">R$ 0</span>
          <span className="text-gray-500">/pra sempre</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {["Sem mensalidade", "Sem cartão", "Comece em minutos"].map((t) => (
            <div key={t} className="rounded-xl border border-white/10 bg-white/[0.02] py-3 text-xs md:text-sm font-semibold text-gray-200">{t}</div>
          ))}
        </div>
        <GradientBorder gradient="from-teal-500 via-cyan-500 to-teal-600" containerClassName="rounded-full p-[1px] inline-block">
          <Link to="/entrar?tab=register" className="px-10 py-4 bg-black text-white font-semibold rounded-full hover:bg-gray-900 transition-all flex items-center gap-2 group">
            <RollingText text="Criar meu Co-pilot" />
          </Link>
        </GradientBorder>
        <p className="text-xs text-gray-500 mt-5">Você só paga por serviços avulsos, se quiser — e o valor aparece antes de confirmar.</p>
      </motion.div>
    </div>
  </section>
);
