import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Camera, Check, ChevronDown, Sparkles, ArrowRight, Briefcase,
  TrendingUp, Fuel, ShieldAlert, MessageCircle,
} from "lucide-react";
import { useState } from "react";

// LP 3 de campanha (tráfego pago) — foco único: MOTORISTA DE APLICATIVO (TotexCar Co-pilot PRO).
// Standalone. Um único CTA → cadastro. Promessa: "quanto sobra DE VERDADE no fim da semana".
const CTA_LINK = "/entrar?tab=register";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6 },
};

function CtaButton({ big = false, label = "Descobrir meu lucro real — grátis" }: { big?: boolean; label?: string }) {
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
    q: "Conecta direto na Uber/99?",
    a: "Não precisa. Você manda o print da tela de ganhos do app (aquela que você já abre todo dia) e a IA lê e registra em segundos. Funciona com Uber, 99, inDriver, táxi e corrida particular — qualquer fonte de ganho.",
  },
  {
    q: "Como ele calcula o lucro por km?",
    a: "Ganhos (pelos prints) menos gastos (foto dos cupons de combustível, manutenção, parcela do carro) dividido pelos km rodados (foto do hodômetro). Resultado: quanto sobra por semana e quanto você lucra em cada km rodado.",
  },
  {
    q: "E multas?",
    a: "Manda a foto da multa que a IA analisa falhas processuais previstas na lei e gera um modelo de recurso pronto pra protocolar — além de te lembrar do prazo. A decisão final é do órgão autuador.",
  },
  {
    q: "Quanto custa?",
    a: "7 dias grátis, sem cartão. Depois, o TotexCar Co-pilot PRO custa R$ 29,90/mês — menos de uma corrida por mês. No plano anual, R$ 299 à vista: 12 meses pelo preço de 10 (~17% de desconto). E se você comprou seu carro numa loja parceira Totexmotors, use o cupom da loja: R$ 10,99/mês com o PRO incluso.",
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

export function Lp3() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* Header mínimo */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#050505]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/totexmotors-logo.png" alt="Totexmotors" className="h-7 object-contain" />
            <span className="font-bold tracking-tight text-sm hidden sm:block">
              TotexCar <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Co-pilot PRO</span>
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
              <Briefcase className="w-3.5 h-3.5" /> Feito pra quem vive do volante — Uber · 99 · táxi
            </motion.div>
            <motion.h1 {...fadeUp} transition={{ duration: 0.6, delay: 0.05 }} className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Você fatura.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Mas quanto SOBRA?</span>
            </motion.h1>
            <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="mt-5 text-gray-400 text-lg leading-relaxed max-w-lg">
              Print dos ganhos + foto do cupom + foto do hodômetro, tudo no WhatsApp. O Co-pilot PRO calcula
              seu <strong className="text-gray-200">lucro real da semana</strong> e o seu
              <strong className="text-gray-200"> lucro por km rodado</strong> — o número que decide se a corrida vale a pena.
            </motion.p>
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.15 }} className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <CtaButton big />
              <span className="text-xs text-gray-500">7 dias grátis · Sem cartão · Sem aparelho no carro</span>
            </motion.div>
          </div>

          {/* Mockup de conversa WhatsApp — fluxo do motorista */}
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
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">TotexCar Co-pilot PRO</p>
                  <p className="text-[11px] text-teal-300 mt-0.5">online</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-4 min-h-[380px]">
                <Bubble me delay={0.1}>📸 <em>print dos ganhos da semana — Uber</em></Bubble>
                <Bubble delay={0.35}>Ganhos registrados: <strong>R$ 1.847</strong> (Uber, 23–29/06) 💵 Manda também os cupons de combustível da semana!</Bubble>
                <Bubble me delay={0.6}>📸 <em>cupom do posto + foto do hodômetro</em></Bubble>
                <Bubble delay={0.85}>Fechou! Resumo da sua semana:<br />💵 Faturou <strong>R$ 1.847</strong><br />💸 Gastou <strong>R$ 612</strong> (combustível, parcela, lavagem)<br />✅ Sobrou: <strong>R$ 1.235</strong><br />🛣️ 1.230 km → <strong>R$ 1,00 de lucro por km</strong></Bubble>
                <Bubble me delay={1.1}>Vale a pena rodar na madrugada?</Bubble>
                <Bubble delay={1.35}>Seu custo é <strong>R$ 0,50/km</strong>. Se a corrida pagar acima disso por km, é lucro — abaixo, você está pagando pra trabalhar. 😉</Bubble>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* DOR */}
      <section className="px-4 py-14 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 {...fadeUp} className="text-2xl md:text-4xl font-bold leading-tight">
            Faturamento alto com lucro baixo é <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">a armadilha do app</span>
          </motion.h2>
          <motion.p {...fadeUp} className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Combustível, manutenção, parcela do carro, pneu, multa… Sem saber o custo por km, você aceita
            corrida que dá prejuízo sem perceber. O Co-pilot PRO transforma seus prints e cupons no número
            que importa: <strong className="text-gray-200">quanto sobrou — no total e por km.</strong>
          </motion.p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="px-4 py-14">
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-10">
            Rotina de <span className="text-teal-400">30 segundos por dia</span>
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: TrendingUp, t: "1. Print dos ganhos", d: "Aquela tela de ganhos que você já abre todo dia? Manda o print no WhatsApp. A IA lê Uber, 99, inDriver — qualquer app." },
              { icon: Camera, t: "2. Foto dos gastos + hodômetro", d: "Cupom do posto, manutenção, lavagem… e a foto do painel. A IA registra e calcula seu consumo real (km/L)." },
              { icon: MessageCircle, t: "3. Lucro na palma da mão", d: "Toda segunda, seu resumo: faturou, gastou, SOBROU e lucro por km. E pergunte o que quiser, quando quiser." },
            ].map((s, i) => (
              <motion.div key={s.t} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="font-bold mb-1.5">{s.t}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES PRO */}
      <section className="px-4 py-14 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-10">
            Ferramenta de trabalho, não app de planilha
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: TrendingUp, t: "Lucro real por semana e por km", d: "Ganhos − custos ÷ km rodados. Saiba se a semana valeu e qual o seu piso por corrida." },
              { icon: Fuel, t: "Consumo de verdade (km/L)", d: "Seu carro está bebendo mais? Você percebe na hora — antes de virar prejuízo no fim do mês." },
              { icon: ShieldAlert, t: "Multas analisadas com IA", d: "Quem roda o dia inteiro toma multa. Foto do auto → a IA busca falhas legais e gera o recurso pronto." },
              { icon: Camera, t: "Zero digitação", d: "Print, foto ou áudio no WhatsApp. Manutenção por km, alertas de IPVA/licenciamento/CNH e parcela em dia." },
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
            <p className="text-xs font-semibold tracking-widest text-teal-400 uppercase mb-3">TotexCar Co-pilot PRO</p>
            <div className="flex items-end justify-center gap-2 mb-1">
              <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">R$ 29,90</span>
              <span className="text-gray-400 pb-1.5">/mês</span>
            </div>
            <p className="text-xs text-gray-500 mb-6">menos de uma corrida por mês · anual R$ 299 à vista (12 pelo preço de 10)</p>
            <ul className="text-sm text-gray-300 space-y-2.5 text-left max-w-xs mx-auto mb-7">
              {[
                "7 dias grátis — sem cartão",
                "Lucro semanal + lucro por km",
                "Ganhos por print (Uber, 99, qualquer app)",
                "Consumo real km/L + custo por km",
                "Multas com IA + recurso pronto",
                "Alertas de IPVA, CNH, revisão e parcelas",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" /> {b}
                </li>
              ))}
            </ul>
            <CtaButton big label="Começar meus 7 dias grátis" />
            <p className="text-[11px] text-gray-600 mt-4">
              Comprou seu carro numa loja parceira Totexmotors? Use o cupom da loja: <strong className="text-gray-400">R$ 10,99/mês com o PRO incluso</strong>.
            </p>
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
          Quem sabe o próprio número,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">dirige melhor o negócio.</span>
        </motion.h2>
        <CtaButton big />
        <footer className="mt-14 space-y-2 max-w-2xl mx-auto">
          <p className="text-xs text-gray-600">
            ⚖️ A análise de multas gera um modelo de recurso elaborado por IA; a decisão final é do órgão autuador.
            O TotexCar Co-pilot PRO não é afiliado à Uber, 99 ou outros aplicativos citados.
          </p>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Totexmotors · TotexCar Co-pilot PRO ·{" "}
            <Link to="/privacy-policy" className="underline hover:text-gray-400">Privacidade</Link> ·{" "}
            <Link to="/terms-conditions" className="underline hover:text-gray-400">Termos</Link>
          </p>
        </footer>
      </section>
    </div>
  );
}

export default Lp3;
