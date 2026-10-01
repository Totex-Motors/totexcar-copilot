import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, Ban, Sparkles } from "lucide-react";

// CONFIANÇA — "Seus dados trabalham pra você." Curto, humano, sem juridiquês, sem dark pattern.
// A confiança é o ativo que sustenta todo o resto.
const POINTS = [
  { icon: Eye, t: "Só você vê", s: "Suas conversas, gastos e documentos são seus. A loja nunca lê o que você fala com o Co-pilot." },
  { icon: Ban, t: "Nada de vender cadastro", s: "A gente não vende seus dados. Se um serviço aparece, é porque pode resolver algo pra você." },
  { icon: Sparkles, t: "Quanto mais ele conhece, mais ajuda", s: "Os dados servem pra uma coisa: deixar o Co-pilot mais útil pro seu carro." },
  { icon: Lock, t: "Você no controle", s: "Edita, exporta ou apaga quando quiser. LGPD na prática, não só no rodapé." },
];

export const TrustData = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      <div>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Seus dados devem <span className="text-teal-400">trabalhar pra você.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg leading-relaxed mb-6">
          Pra contar ao Co-pilot quanto você gasta, qual carro tem e quando pensa em trocar, você precisa confiar nele. A gente leva isso a sério.
        </motion.p>
        <Link to="/privacy-policy" className="text-sm font-semibold text-teal-400 hover:text-teal-300">Ler a política de privacidade →</Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {POINTS.map((p, i) => {
          const Ic = p.icon;
          return (
            <motion.div key={p.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center mb-3"><Ic className="w-5 h-5 text-teal-400" /></div>
              <h3 className="font-bold text-white mb-1">{p.t}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{p.s}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);
