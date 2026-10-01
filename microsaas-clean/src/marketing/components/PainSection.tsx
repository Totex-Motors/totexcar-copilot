import { motion } from "framer-motion";
import { Fuel, Wrench, CalendarDays, Coins } from "lucide-react";

// A DOR — "Combustível é só o começo." Concreta e verdadeira: cada card é um dado que o app acompanha.
const CARDS = [
  { icon: Fuel, t: "Combustível", s: "Quanto você realmente gasta por mês — e por km?" },
  { icon: Wrench, t: "Manutenção", s: "Quanto os pequenos reparos estão somando sem você ver?" },
  { icon: CalendarDays, t: "Próximos gastos", s: "IPVA, licenciamento, seguro, revisão: o que está chegando e ainda não está no orçamento?" },
  { icon: Coins, t: "Custo real", s: "Quanto cada quilômetro do seu carro custa pra você?" },
];

export const PainSection = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-6xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Você sabe quanto abasteceu. <br />
          <span className="text-gray-400">Mas sabe quanto seu carro custa?</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg leading-relaxed">
          Combustível é só o começo. Seguro, IPVA, revisão, pneus, estacionamento, pedágio, multa.
          Separados parecem pequenos. <span className="text-white">Somados, contam a história de verdade do seu carro</span> — e quase ninguém acompanha isso.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((c, i) => {
          const Ic = c.icon;
          return (
            <motion.div key={c.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-teal-500/30 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center mb-4"><Ic className="w-5 h-5 text-teal-400" /></div>
              <h3 className="font-bold text-white mb-1.5">{c.t}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{c.s}</p>
            </motion.div>
          );
        })}
      </div>

      <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-2xl md:text-3xl font-semibold text-white mt-14 tracking-tight">
        O problema não é gastar com o carro. <br className="hidden md:block" />
        <span className="text-teal-400">É descobrir o tamanho do gasto tarde demais.</span>
      </motion.p>
    </div>
  </section>
);
