import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Camera, ShieldAlert, Check, ChevronDown, Sparkles, ArrowRight,
  Scale, FileText, BellRing, MessageCircle,
} from "lucide-react";
import { useState } from "react";

// LP 2 de campanha (tráfego pago) — foco único: ANTI-MULTAS com IA.
// Standalone (sem navbar do site). Um único CTA → cadastro. Claims honestos (nunca "garantimos").
const CTA_LINK = "/entrar?tab=register";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6 },
};

function CtaButton({ big = false, label = "Analisar minha multa grátis" }: { big?: boolean; label?: string }) {
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

const VICIOS = [
  { t: "Notificação fora do prazo", d: "A notificação da autuação deve ser expedida em até 30 dias — fora disso, o auto deve ser arquivado.", lei: "Art. 281, § único, II, CTB" },
  { t: "Dados obrigatórios errados ou faltando", d: "Placa, modelo, cor, local, data/hora ou enquadramento divergentes são vício formal do auto.", lei: "Res. CONTRAN 918/2022" },
  { t: "Falta da dupla notificação", d: "São obrigatórias DUAS notificações: a da autuação e a da penalidade. Recebeu só a cobrança? Vício.", lei: "Arts. 280–282, CTB" },
  { t: "Radar sem aferição válida", d: "O medidor de velocidade precisa de verificação anual do INMETRO, identificada no auto.", lei: "Res. CONTRAN 798/2020" },
  { t: "Sinalização irregular", d: "Fiscalização de velocidade exige sinalização visível antes do equipamento.", lei: "Resoluções CONTRAN" },
];

const FAQS = [
  {
    q: "Como funciona a análise da multa?",
    a: "Você manda a foto do auto de infração no WhatsApp. A IA lê os dados, cruza com as falhas processuais previstas na lei (CTB e resoluções do CONTRAN), faz 2–3 perguntas se precisar (ex.: quando você recebeu a notificação) e gera um modelo de recurso pronto pra protocolar, com a fundamentação legal.",
  },
  {
    q: "Vocês garantem que a multa vai ser cancelada?",
    a: "Não — e desconfie de quem garante. A decisão é sempre do órgão autuador. O que fazemos é identificar falhas reais no auto de infração e gerar um recurso bem fundamentado, o que aumenta suas chances de deferimento.",
  },
  {
    q: "Onde eu protocolo o recurso?",
    a: "No órgão autuador (site, JARI ou presencialmente), dentro do prazo indicado na notificação. O recurso fica salvo no app pra copiar ou baixar — e a gente te lembra do prazo no WhatsApp.",
  },
  {
    q: "Quanto custa?",
    a: "Você começa com 7 dias grátis, sem cartão. Depois, o plano Totex Care custa R$ 109,90/mês — membros do ecossistema Totexmotors pagam R$ 10,99/mês com o cupom da loja parceira. Plano anual: R$ 109,90 à vista, 12 meses pelo preço de 10 (~17% de desconto). E não é só multa: o Co-pilot cuida de todos os gastos, consumo e prazos do seu carro.",
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

export function Lp2() {
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
              <Scale className="w-3.5 h-3.5" /> Análise de multas com Inteligência Artificial
            </motion.div>
            <motion.h1 {...fadeUp} transition={{ duration: 0.6, delay: 0.05 }} className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Recebeu uma multa?<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Não pague sem analisar.</span>
            </motion.h1>
            <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="mt-5 text-gray-400 text-lg leading-relaxed max-w-lg">
              Muitos autos de infração têm <strong className="text-gray-200">falhas processuais</strong> previstas
              na própria lei. Mande a foto da multa no WhatsApp: a IA confere ponto por ponto e gera seu
              recurso pronto pra protocolar — em minutos.
            </motion.p>
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.15 }} className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <CtaButton big />
              <span className="text-xs text-gray-500">7 dias grátis · Sem cartão de crédito</span>
            </motion.div>
          </div>

          {/* Mockup de conversa WhatsApp — fluxo de multa */}
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
                  <p className="text-sm font-semibold leading-none">TotexCar Co-pilot</p>
                  <p className="text-[11px] text-teal-300 mt-0.5">online</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-4 min-h-[380px]">
                <Bubble me delay={0.1}>📸 <em>foto do auto de infração</em></Bubble>
                <Bubble delay={0.35}>Li seu auto: excesso de velocidade, <strong>R$ 195,23</strong>, 5 pontos. Me conta: quando você RECEBEU essa notificação? 📅</Bubble>
                <Bubble me delay={0.6}>Chegou semana passada, a infração foi em março</Bubble>
                <Bubble delay={0.85}>⚠️ Achei <strong>2 possíveis falhas</strong>: notificação expedida fora dos 30 dias (<strong>Art. 281 CTB</strong>) e o auto não identifica a aferição do radar (<strong>Res. 798/2020</strong>). Seu recurso está pronto ⚖️</Bubble>
                <Bubble delay={1.1}>📄 <em>Recurso com fundamentação legal — é só copiar e protocolar. Eu te lembro do prazo!</em></Bubble>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* OS 5 VÍCIOS */}
      <section className="px-4 py-14 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.h2 {...fadeUp} className="text-2xl md:text-4xl font-bold text-center leading-tight mb-3">
            As 5 falhas que a IA confere <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">em toda multa</span>
          </motion.h2>
          <motion.p {...fadeUp} className="text-gray-400 text-center max-w-2xl mx-auto mb-10">
            São exigências da própria legislação de trânsito. Quando o órgão falha em alguma, o auto pode ser anulado.
          </motion.p>
          <div className="grid md:grid-cols-2 gap-4">
            {VICIOS.map((v, i) => (
              <motion.div key={v.t} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.07 }}
                className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex gap-4 ${i === 4 ? "md:col-span-2" : ""}`}>
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{v.t}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{v.d}</p>
                  <p className="text-xs text-teal-400/80 mt-1.5 font-medium">{v.lei}</p>
                </div>
              </motion.div>
            ))}
          </div>
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
              { icon: Camera, t: "1. Fotografe a multa", d: "Tire uma foto nítida do auto de infração ou da notificação e mande no WhatsApp." },
              { icon: MessageCircle, t: "2. A IA analisa e pergunta", d: "Ela extrai os dados, confere as 5 falhas legais e faz 2–3 perguntas certeiras — como um despachante faria." },
              { icon: FileText, t: "3. Recurso pronto + prazo vigiado", d: "Você recebe o modelo de recurso com a fundamentação legal. E o Co-pilot te lembra do prazo no WhatsApp." },
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

      {/* E NÃO PARA NAS MULTAS */}
      <section className="px-4 py-14 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 {...fadeUp} className="text-2xl md:text-3xl font-bold mb-3">
            E o mesmo assistente cuida do <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">carro inteiro</span>
          </motion.h2>
          <motion.p {...fadeUp} className="text-gray-400 max-w-2xl mx-auto mb-8">
            A análise de multas faz parte do TotexCar Co-pilot: foto do cupom registra o gasto, foto do
            hodômetro mede seu consumo real (km/L), e você recebe alertas de IPVA, licenciamento, seguro,
            CNH e revisão — tudo pelo WhatsApp.
          </motion.p>
          <motion.div {...fadeUp} className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Camera, t: "Gastos por foto" },
              { icon: Sparkles, t: "Consumo real (km/L)" },
              { icon: BellRing, t: "Alertas de prazos" },
              { icon: ShieldAlert, t: "Multas com IA" },
            ].map((f) => (
              <span key={f.t} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
                <f.icon className="w-4 h-4 text-teal-400" /> {f.t}
              </span>
            ))}
          </motion.div>
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
                "Análise de multas ilimitada",
                "Recurso pronto com base legal",
                "Alerta do prazo de recurso",
                "Gastos, consumo e vencimentos do carro",
                "Anual: R$ 109,90 à vista (~17% off)",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" /> {b}
                </li>
              ))}
            </ul>
            <CtaButton big label="Quero analisar minhas multas" />
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
          Sua CNH e seu bolso agradecem.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Começa com a foto da multa.</span>
        </motion.h2>
        <CtaButton big />
        <footer className="mt-14 space-y-2 max-w-2xl mx-auto">
          <p className="text-xs text-gray-600">
            ⚖️ A análise gera um <strong>modelo</strong> de recurso elaborado por IA com base nos dados informados
            e na legislação de trânsito. A decisão final é sempre do órgão autuador — não há garantia de
            deferimento. Este serviço não substitui a orientação de um advogado.
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

export default Lp2;
