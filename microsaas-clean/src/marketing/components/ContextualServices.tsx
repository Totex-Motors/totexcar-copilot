import { motion } from "framer-motion";
import { FileCheck2, IdCard, Search, ScanLine, Wrench, ShieldCheck, Warehouse } from "lucide-react";

// SERVIÇOS CONTEXTUAIS — o modelo de receita contado com honestidade: o app é grátis;
// o serviço aparece quando resolve algo. Nunca vitrine de banner. Tudo aqui existe no produto.
const ITEMS = [
  { icon: FileCheck2, t: "Raio-X do carro", s: "Consulta cautelar: leilão, sinistro, roubo, gravame.", when: "Vai comprar ou vender um usado" },
  { icon: IdCard, t: "CRLV-e na hora", s: "O documento digital do carro, emitido no app.", when: "Precisou do documento" },
  { icon: Search, t: "Débitos & multas", s: "IPVA, licenciamento e multas por órgão.", when: "O IPVA está vencendo" },
  { icon: ScanLine, t: "Consulta de CNH", s: "Pontos, situação e validade da habilitação.", when: "Levou uma multa com pontos" },
  { icon: Wrench, t: "Oficinas parceiras", s: "Perto de você, com benefício exclusivo pra quem usa o Co-pilot.", when: "A revisão está chegando" },
  { icon: ShieldCheck, t: "Seguro", s: "Cotação comparada antes de renovar no automático.", when: "O seguro vence em 30 dias" },
  { icon: Warehouse, t: "Garagem Totex", s: "Quanto vale o seu carro (FIPE) e o estoque real pra trocar.", when: "Começou a pensar em trocar" },
];

export const ContextualServices = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-6xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Quando você precisar de alguma coisa, <span className="text-gray-400">a gente ajuda a encontrar.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg leading-relaxed">
          O app é grátis. Serviços oficiais e parceiros aparecem <span className="text-white">só quando fazem sentido naquele momento</span> — e o valor sempre aparece antes de você confirmar. Nada de propaganda.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITEMS.map((it, i) => {
          const Ic = it.icon;
          return (
            <motion.div key={it.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex gap-4 hover:border-teal-500/30 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0"><Ic className="w-5 h-5 text-teal-400" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wider uppercase text-teal-400/80 mb-1">{it.when}</p>
                <h3 className="font-bold text-white">{it.t}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mt-1">{it.s}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-600 mt-8">A recomendação aparece porque faz sentido naquele momento — não porque alguém pagou pra aparecer.</p>
    </div>
  </section>
);
