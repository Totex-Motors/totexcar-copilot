import { motion } from "framer-motion";
import { CalendarDays, Wrench, ShieldCheck, Sparkles } from "lucide-react";

// MOMENTO "EU QUERO ISSO" — cards estilo notificação com os alertas que o Co-pilot REALMENTE manda:
// vencimentos (IPVA/licenciamento/seguro/CNH), revisão por km e a ação contextual que vem junto.
const ALERTS = [
  { icon: CalendarDays, tag: "Vencimento", t: "Seu IPVA vence em 12 dias.", s: "Quer que eu já mostre o valor e os débitos da placa?", cta: "Ver débitos" },
  { icon: Wrench, tag: "Manutenção por km", t: "Troca de óleo chegando.", s: "Pelo seu km, faltam ~800 km. Tem oficina parceira perto de você com 10% na primeira visita.", cta: "Ver oficinas" },
  { icon: ShieldCheck, tag: "Seguro", t: "Seu seguro vence em 30 dias.", s: "Quer cotar antes de renovar no automático? Eu comparo pra você.", cta: "Cotar seguro" },
];

export const SmartAlerts = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="absolute inset-0 bg-teal-600/[0.04] pointer-events-none" />
    <div className="relative max-w-6xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Imagine abrir o WhatsApp <br /><span className="text-gray-400">e encontrar isso:</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg">
          Não é uma planilha bonita. É um assistente olhando o carro junto com você — e avisando antes da conta chegar.
        </motion.p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {ALERTS.map((a, i) => {
          const Ic = a.icon;
          return (
            <motion.div key={a.t} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 shadow-[0_20px_60px_-20px_rgba(20,184,166,0.25)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></span>
                <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400">TotexCar Co-pilot · agora</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0"><Ic className="w-5 h-5 text-teal-400" /></span>
                <div>
                  <p className="text-[11px] font-bold tracking-wider uppercase text-teal-400 mb-1">{a.tag}</p>
                  <p className="font-bold text-white leading-snug">{a.t}</p>
                  <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{a.s}</p>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300">{a.cta} →</div>
            </motion.div>
          );
        })}
      </div>

      <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-xl md:text-2xl font-semibold text-white mt-14 tracking-tight">
        Menos “quanto será que vai ficar?” <span className="text-teal-400">Mais “eu já estava preparado.”</span>
      </motion.p>
    </div>
  </section>
);
