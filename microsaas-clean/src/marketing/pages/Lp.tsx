import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Camera, Gauge, ShieldAlert, BellRing, Check, ChevronDown,
  MessageCircle, Sparkles, ArrowRight, Fuel,
} from "lucide-react";
import { useState } from "react";

// LP de campanha (tráfego pago) — foco único: TotexCar Co-pilot no WhatsApp.
// Standalone (sem navbar/footer do site) pra não vazar cliques. Um único CTA → cadastro.
const CTA_LINK = "/entrar?tab=register";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6 },
};

function CtaButton({ big = false, label = "Começar grátis — 7 dias" }: { big?: boolean; label?: string }) {
  return (
    <Link
      to={CTA_LINK}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white
        bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400
        shadow-[0_10px_40px_-10px_rgba(20,184,166,0.6)] transition-all hover:scale-[1.02]
        ${big ? "px-8 py-4 text-lg" : "px-6 py-3 text-sm"}`}
    >
      {label} <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

// Bolha estilo WhatsApp
function Bubble({ me, children, delay = 0 }: { me?: boolean; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow
        ${me ? "self-end bg-[#005c4b] text-white rounded-tr-sm" : "self-start bg-[#1f2c33] text-gray-100 rounded-tl-sm"}`}
    >
      {children}
    </motion.div>
  );
}

const FAQS = [
  {
    q: "Preciso instalar alguma coisa no carro?",
    a: "Não! Nada de aparelhos ou fios. O Co-pilot funciona 100% pelo WhatsApp: você manda foto do cupom, do hodômetro ou da multa, e ele faz o resto.",
  },
  {
    q: "Como ele calcula meu consumo?",
    a: "A cada abastecimento você manda a foto do cupom e a foto do hodômetro. A partir do segundo abastecimento, ele calcula: km rodados ÷ litros = seu km/L real, e quanto custa cada km que você roda.",
  },
  {
    q: "Como funciona a análise de multas?",
    a: "Você manda a foto do auto de infração. A IA confere falhas processuais previstas na lei (prazo de notificação, dados obrigatórios, dupla notificação, aferição do radar, sinalização) e gera um modelo de recurso pronto pra protocolar. A decisão final é sempre do órgão autuador.",
  },
  {
    q: "Quanto custa depois dos 7 dias?",
    a: "O plano cheio é R$ 109,90/mês, mas membros do ecossistema Totexmotors pagam R$ 10,99/mês com o cupom da loja parceira. E tem o plano anual: R$ 109,90 à vista — 12 meses pelo preço de 10 (~17% de desconto). Pagamento via PIX ou cartão.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-medium text-white text-sm md:text-base">{q}</span>
        <ChevronDown className={`w-4 h-4 text-teal-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">{a}</p>}
    </div>
  );
}

export function Lp() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* Header mínimo */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#050505]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/totexmotors-logo.png" alt="Totexmotors" className="h-7 object-contain" />
            <span className="font-bold tracking-tight text-sm hidden sm:block">
              Totexcar <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Co-pilot</span>
            </span>
          </div>
          <CtaButton label="Começar grátis" />
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-4 pt-14 md:pt-20 pb-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-teal-600/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div>
            <motion.div {...fadeUp} className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-medium text-teal-300 mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Inteligência Artificial no seu WhatsApp
            </motion.div>
            <motion.h1 {...fadeUp} transition={{ duration: 0.6, delay: 0.05 }} className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Manda uma foto.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">O Co-pilot cuida do seu carro.</span>
            </motion.h1>
            <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="mt-5 text-gray-400 text-lg leading-relaxed max-w-lg">
              Foto do cupom → gasto registrado. Foto do hodômetro → seu consumo real (km/L).
              Foto da multa → recurso pronto. E ele ainda te avisa de IPVA, seguro e revisão.
            </motion.p>
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.15 }} className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <CtaButton big />
              <span className="text-xs text-gray-500">Sem cartão de crédito · Ativa em 2 minutos</span>
            </motion.div>
          </div>

          {/* Mockup de conversa WhatsApp */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="rounded-[2rem] border border-white/10 bg-[#0b141a] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className="flex items-center gap-3 bg-[#1f2c33] px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-white w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">TotexCar Co-pilot</p>
                  <p className="text-[11px] text-teal-300 mt-0.5">online</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-4 min-h-[380px]">
                <Bubble me delay={0.1}>📸 <em>foto do cupom do posto</em></Bubble>
                <Bubble delay={0.35}>Abastecimento registrado: <strong>R$ 250</strong> · 47,1 L de gasolina ⛽ Agora me manda a foto do hodômetro pra eu medir seu consumo!</Bubble>
                <Bubble me delay={0.6}>📸 <em>foto do painel — 48.230 km</em></Bubble>
                <Bubble delay={0.85}>Anotado! Você rodou <strong>512 km</strong> e usou <strong>47,1 litros</strong> → <strong>10,9 km/L</strong>. Cada km te custou <strong>R$ 0,49</strong> 🚗</Bubble>
                <Bubble me delay={1.1}>📸 <em>foto de uma multa</em></Bubble>
                <Bubble delay={1.35}>Analisei seu auto de infração: encontrei <strong>2 possíveis falhas</strong> (notificação fora do prazo — Art. 281 CTB). Seu recurso está pronto pra protocolar ⚖️</Bubble>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* DOR */}
      <section className="px-4 py-14 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 {...fadeUp} className="text-2xl md:text-4xl font-bold leading-tight">
            Você sabe quanto seu carro te custa <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">por km rodado?</span>
          </motion.h2>
          <motion.p {...fadeUp} className="mt-4 text-gray-400 max-w-2xl mx-auto">
            A maioria dos motoristas não faz ideia. Gastos espalhados, consumo no "achômetro",
            revisão atrasada e multa vencendo na gaveta. O Co-pilot resolve isso com fotos no WhatsApp —
            sem planilha, sem app complicado, sem aparelho no carro.
          </motion.p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="px-4 py-14">
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-10">
            Como funciona — <span className="text-teal-400">3 passos</span>
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Camera, t: "1. Fotografe", d: "Cupom do posto, nota da revisão, multa ou o painel do carro. Pode mandar áudio ou texto também." },
              { icon: MessageCircle, t: "2. Mande no WhatsApp", d: "A IA lê, entende e registra sozinha: valor, litros, categoria, quilometragem. Em segundos." },
              { icon: Gauge, t: "3. Receba inteligência", d: "Consumo real (km/L), custo por km, gastos do mês, recurso de multa e alertas de vencimento." },
            ].map((s, i) => (
              <motion.div key={s.t} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center mb-4">
                  <s.icon className="w-5.5 h-5.5 text-teal-400 w-5 h-5" />
                </div>
                <h3 className="font-bold mb-1.5">{s.t}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* O QUE ELE FAZ */}
      <section className="px-4 py-14 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-10">
            Um co-piloto completo pro seu carro
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: Fuel, t: "Consumo de verdade (km/L)", d: "Litros vs km rodados a cada tanque. Descubra seu km/L real e quanto custa cada km — e perceba na hora quando o carro começa a beber mais." },
              { icon: ShieldAlert, t: "Multas com IA", d: "Foto do auto de infração → a IA cruza com falhas processuais da lei (CTB e resoluções do CONTRAN) e gera um modelo de recurso pronto pra protocolar." },
              { icon: BellRing, t: "Nunca mais esqueça um prazo", d: "IPVA, licenciamento, seguro, CNH, parcela do financiamento, troca de óleo por km e prazo de recurso de multa — te avisamos no WhatsApp." },
              { icon: Camera, t: "Registro sem digitar", d: "Foto, áudio ou texto. A IA lê cupons e notas, categoriza e organiza tudo. Relatórios e gráficos no painel quando você quiser." },
            ].map((f, i) => (
              <motion.div key={f.t} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{f.t}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* OFERTA */}
      <section className="px-4 py-16 border-t border-white/5 relative">
        <div className="absolute inset-x-0 top-0 h-full bg-teal-600/5 pointer-events-none" />
        <div className="relative max-w-lg mx-auto text-center">
          <motion.div {...fadeUp} className="rounded-3xl border border-teal-500/30 bg-[#0a0a0c] p-8 shadow-[0_30px_80px_-20px_rgba(20,184,166,0.25)]">
            <p className="text-xs font-semibold tracking-widest text-teal-400 uppercase mb-3">Plano Totex Care</p>
            <div className="flex items-end justify-center gap-2 mb-1">
              <span className="text-gray-500 line-through text-lg">R$ 109,90</span>
              <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">R$ 10,99</span>
              <span className="text-gray-400 pb-1.5">/mês</span>
            </div>
            <p className="text-xs text-gray-500 mb-6">com cupom de loja parceira Totexmotors (90% off)</p>
            <ul className="text-sm text-gray-300 space-y-2.5 text-left max-w-xs mx-auto mb-7">
              {[
                "7 dias grátis — sem cartão",
                "IA ilimitada no WhatsApp",
                "Consumo km/L + custo por km",
                "Análise de multas + recurso pronto",
                "Alertas de todos os vencimentos",
                "Anual: R$ 109,90 à vista (~17% off)",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" /> {b}
                </li>
              ))}
            </ul>
            <CtaButton big label="Quero meu Co-pilot grátis" />
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-14">
        <div className="max-w-2xl mx-auto">
          <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-8">Perguntas frequentes</motion.h2>
          <div className="space-y-3">
            {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* CTA final + footer */}
      <section className="px-4 py-16 border-t border-white/5 text-center">
        <motion.h2 {...fadeUp} className="text-2xl md:text-4xl font-bold mb-6">
          Seu carro no automático.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Começa com uma foto.</span>
        </motion.h2>
        <CtaButton big />
        <footer className="mt-14 space-y-2">
          <p className="text-xs text-gray-600">
            ⚖️ A análise de multas gera um <strong>modelo</strong> de recurso elaborado por IA. A decisão final é do órgão autuador — não há garantia de deferimento.
          </p>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Totexmotors · TotexCar Co-pilot ·{" "}
            <Link to="/privacy-policy" className="underline hover:text-gray-400">Privacidade</Link> ·{" "}
            <Link to="/terms-conditions" className="underline hover:text-gray-400">Termos</Link>
          </p>
        </footer>
      </section>
    </div>
  );
}

export default Lp;
