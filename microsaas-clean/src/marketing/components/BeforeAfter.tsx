import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

// ANTES / DEPOIS — "Menos 'eu acho'. Mais 'eu sei'."
const ROWS: [string, string][] = [
  ["“Acho que gasto uns R$ 800.”", "Você sabe exatamente quanto gasta — e por km."],
  ["Descobre o IPVA quando chega.", "É avisado antes, com o valor e os débitos."],
  ["Revisão vira surpresa.", "Revisão vira planejamento, pelo km."],
  ["Cupom na gaveta, nota perdida.", "Foto no WhatsApp, tudo guardado."],
  ["Números difíceis de interpretar.", "O Co-pilot explica com os seus dados."],
];

export const BeforeAfter = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-5xl mx-auto">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-14">
        Menos “eu acho”. <span className="text-teal-400">Mais “eu sei”.</span>
      </motion.h2>
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-5">Sem Co-pilot</p>
          <ul className="space-y-4">
            {ROWS.map(([a]) => <li key={a} className="flex gap-3 text-gray-400"><X className="w-4 h-4 mt-1 shrink-0 text-gray-600" /> <span>{a}</span></li>)}
          </ul>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-2xl border border-teal-500/30 bg-[#0a0a0a] p-6 shadow-[0_0_40px_rgba(20,184,166,0.1)]">
          <p className="text-xs font-bold tracking-widest uppercase text-teal-400 mb-5">Com Co-pilot</p>
          <ul className="space-y-4">
            {ROWS.map(([, b]) => <li key={b} className="flex gap-3 text-white"><Check className="w-4 h-4 mt-1 shrink-0 text-teal-400" /> <span className="font-medium">{b}</span></li>)}
          </ul>
        </motion.div>
      </div>
      <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-2xl md:text-3xl font-semibold text-white mt-14 tracking-tight">
        Seu carro já tem computador de bordo. <br className="hidden md:block" /><span className="text-gray-400">Agora o seu dinheiro também tem.</span>
      </motion.p>
    </div>
  </section>
);
