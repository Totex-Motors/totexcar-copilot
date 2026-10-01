import { motion } from "framer-motion";
import { QrCode, ScanLine, Smartphone, Wrench, Handshake } from "lucide-react";
import { Link } from "react-router-dom";

// QR NO PARA-BRISA — canal físico de aquisição: a pessoa escaneia por uma necessidade real
// ("acompanhar a manutenção") e cai direto no Co-pilot. Oficinas parceiras podem ter o seu.
export const QrSticker = () => (
  <section className="relative w-full py-24 px-6 z-10">
    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      {/* adesivo */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="mx-auto w-full max-w-xs">
        <div className="rounded-2xl bg-white text-[#13211E] p-5 shadow-[0_30px_80px_-20px_rgba(20,184,166,0.35)] rotate-[-3deg]">
          <div className="flex items-center gap-2 mb-3">
            <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-5 w-auto" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#0C6E6A]">TotexCar Co-pilot</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl border-2 border-[#13211E] flex items-center justify-center shrink-0"><QrCode className="w-16 h-16" /></div>
            <p className="text-sm font-bold leading-snug">Aponte a câmera e acompanhe grátis a manutenção do seu carro.</p>
          </div>
          <p className="text-[10px] text-[#5D6E69] mt-3">Próxima troca de óleo: ______ km</p>
        </div>
      </motion.div>

      <div>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xs font-bold tracking-widest uppercase text-teal-400 mb-4">
          Viu o adesivo no para-brisa?
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-6">
          Seu histórico começa <span className="text-teal-400">com um simples scan.</span>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-gray-400 text-lg leading-relaxed mb-8">
          Aquela etiqueta da troca de óleo virou a porta de entrada do seu carro no Co-pilot: escaneou, o carro já está cadastrado e a próxima manutenção, lembrada.
        </motion.p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300 mb-8">
          {[[ScanLine, "Escaneia"], [Smartphone, "Abre o Co-pilot"], [Wrench, "Manutenção do carro em dia"]].map(([Ic, t], i) => {
            const Icon = Ic as any;
            return (
              <span key={String(t)} className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2"><Icon className="w-4 h-4 text-teal-400" /> {t as string}</span>
                {i < 2 && <span className="text-gray-600">→</span>}
              </span>
            );
          })}
        </div>
        <Link to="/parceiro" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400 hover:text-teal-300">
          <Handshake className="w-4 h-4" /> Tem uma oficina? Tenha o seu adesivo com benefício →
        </Link>
      </div>
    </div>
  </section>
);
