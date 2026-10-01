import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Sparkles, FileCheck2, IdCard, Search, ScanLine } from "lucide-react";
import { FAQ } from "../components/FAQ";
import { CTA } from "../components/CTA";
import { GradientBorder } from "../components/ui/GradientBorder";
import { RollingText } from "../components/ui/RollingText";

const PricingFeature = ({ text }: { text: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-1 flex-shrink-0">
      <Check size={14} className="text-teal-400" />
    </div>
    <span className="text-gray-300 text-sm font-medium">{text}</span>
  </div>
);

// Recursos do app — tudo grátis, sem mensalidade.
const freeFeatures = [
  "Assistente de IA no WhatsApp: registre gastos por texto, foto do cupom ou áudio",
  "Alertas de vencimento de IPVA, licenciamento, seguro e CNH",
  "Controle de combustível, peças, revisões, pneus e multas",
  "Consumo real (km/L), custo por km e manutenção por quilometragem",
  "Relatórios e análises dos gastos do seu carro",
  "Avaliação FIPE, Garagem (vitrine) e pedido de recompra",
  "Indique e Ganhe (comissão via PIX)",
];

// Serviços avulsos (pagos só quando você usar) — receita via parceiros credenciados.
const services = [
  { icon: FileCheck2, t: "Raio-X do carro", d: "Consulta cautelar completa: histórico, leilão, sinistro e mais." },
  { icon: IdCard, t: "CRLV-e na hora", d: "Emita o documento digital do veículo direto pelo app." },
  { icon: Search, t: "Débitos & multas", d: "IPVA, licenciamento e multas com detalhamento por órgão." },
  { icon: ScanLine, t: "Consulta de CNH", d: "Pontos, situação e vencimento da sua habilitação." },
];

export const Pricing = () => {
  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      {/* --- HEADER --- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 backdrop-blur-sm px-4 py-1.5 mb-8"
        >
          <Sparkles size={13} className="text-teal-300" />
          <span className="text-[10px] md:text-xs font-bold tracking-widest text-teal-200 uppercase">
            100% grátis · sem mensalidade
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-8 drop-shadow-xl"
        >
          Cuidar do seu carro <br />
          agora é de graça
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-4"
        >
          O TotexCar Co-pilot é gratuito pra todo mundo — dono de carro ou motorista de
          app. Sem plano, sem cartão, sem pegadinha. Você só paga por serviços avulsos
          quando precisar deles (e só se quiser).
        </motion.p>
      </div>

      {/* --- CARD GRÁTIS --- */}
      <div className="relative z-10 max-w-lg mx-auto px-6 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <GradientBorder
            gradient="from-teal-500 via-cyan-500 to-teal-600"
            containerClassName="w-full rounded-3xl p-[1.5px]"
            className="rounded-3xl"
          >
            <div className="relative flex flex-col p-8 rounded-3xl bg-[#0A0A0A] h-full">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap">
                Grátis pra sempre
              </div>

              <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-white mb-2">TotexCar Co-pilot</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-white">R$ 0</span>
                  <span className="text-gray-500 text-sm">/sempre</span>
                </div>
                <p className="text-gray-400 text-sm mt-2">Todo o app, sem mensalidade.</p>
              </div>

              <div className="mb-8">
                <GradientBorder
                  gradient="from-teal-500 via-cyan-500 to-teal-600"
                  containerClassName="w-full rounded-xl p-[1px]"
                  className="rounded-xl"
                >
                  <Link
                    to="/entrar?tab=register"
                    className="w-full py-3 bg-[#0F0F0F] text-white font-medium rounded-xl hover:bg-black transition-colors relative overflow-hidden group block"
                  >
                    <span className="relative z-10 block">
                      <RollingText text="Começar grátis" className="justify-center" />
                    </span>
                  </Link>
                </GradientBorder>
              </div>

              <div className="mt-auto space-y-4">
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">
                  Tudo incluído, sem pagar nada
                </p>
                {freeFeatures.map((feature, i) => (
                  <PricingFeature key={i} text={feature} />
                ))}
              </div>
            </div>
          </GradientBorder>
        </motion.div>
      </div>

      {/* --- SERVIÇOS AVULSOS --- */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 mb-32">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
            Serviços avulsos, só quando precisar
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            O app é grátis. Quando você quiser um documento ou uma consulta oficial,
            paga só por aquele serviço — no Pix ou cartão, direto no app. Sem
            assinatura, sem compromisso.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {services.map((s, i) => {
            const Ic = s.icon;
            return (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                  <Ic className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{s.t}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.d}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-600 mt-6">
          Laudos, vistorias e outros serviços são prestados por parceiros credenciados.
          Os valores aparecem no app antes de você confirmar.
        </p>
      </div>

      <FAQ />
      <CTA />
    </div>
  );
};
