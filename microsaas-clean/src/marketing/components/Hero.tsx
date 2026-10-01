import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GradientBorder } from "./ui/GradientBorder";
import { RollingText } from "./ui/RollingText";
import { WhatsAppPhone, type Bubble } from "./WhatsAppPhone";

// HERO — posicionamento: "copiloto do carro", não "controle de gastos".
// Headline à esquerda + celular mostrando a conversa REAL no WhatsApp à direita.
// Tudo que aparece na tela do celular é o que o produto faz hoje (foto do cupom, km/L, alerta de IPVA).
const BUBBLES: Bubble[] = [
  { me: true, text: <>📸 <em>foto do cupom do posto</em></> },
  { text: <>Abastecimento registrado: <strong>R$ 250</strong> · 47,1 L ⛽ Me manda a foto do hodômetro que eu calculo seu consumo.</> },
  { me: true, text: <>📸 <em>painel — 48.230 km</em></> },
  { text: <>Você fez <strong>10,9 km/L</strong>. Cada km te custou <strong>R$ 0,49</strong> 🚗</> },
  { text: <>📅 Lembrete: seu <strong>IPVA vence em 12 dias</strong>. Quer ver o valor e os débitos da placa?</> },
];

export const Hero = () => {
  return (
    <div className="relative w-full overflow-hidden pt-32 pb-16 md:pt-40 md:pb-28">
      {/* glow discreto (ciano Totex em pontos estratégicos, não dominando a tela) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-teal-600/15 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* texto */}
        <div className="text-center md:text-left">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
            <div className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-950/10 backdrop-blur-md px-4 py-1.5 shadow-[0_0_20px_rgba(20,184,166,0.1)]">
              <span className="text-[10px] md:text-xs font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-teal-400">
                Totex Motors apresenta · grátis
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-6 drop-shadow-2xl"
          >
            Seu carro, cuidado <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500">pelo WhatsApp.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl max-w-xl md:max-w-none leading-relaxed mb-9 font-light mx-auto"
          >
            Manda a foto do cupom, da multa ou do painel. O Co-pilot registra, te avisa dos vencimentos
            e mostra quanto o carro custa de verdade. <span className="text-white font-medium">Grátis, sem mensalidade.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center md:items-start gap-4 mb-5 justify-center md:justify-start"
          >
            <GradientBorder gradient="from-teal-500 via-cyan-500 to-teal-600" containerClassName="rounded-full p-[1px]">
              <Link to="/entrar?tab=register" className="px-10 py-4 bg-black text-white font-semibold rounded-full hover:bg-gray-900 transition-all flex items-center gap-2 group">
                <RollingText text="Começar grátis" />
              </Link>
            </GradientBorder>
            <a href="#como-funciona" className="px-10 py-4 text-white font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors backdrop-blur-sm group">
              <RollingText text="Ver como funciona" />
            </a>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="text-xs text-gray-500">
            Sem cartão · Cadastre o carro em 2 minutos · Não precisa instalar nada no carro
          </motion.p>
        </div>

        {/* celular com o WhatsApp */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto w-full max-w-sm"
        >
          <div className="absolute -inset-6 bg-teal-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <WhatsAppPhone bubbles={BUBBLES} delay={0.5} />
          </div>
        </motion.div>
      </div>
    </div>
  );
};
