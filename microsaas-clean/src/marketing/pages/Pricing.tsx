import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { TrustLogos } from "../components/TrustLogos";
import { Testimonials } from "../components/Testimonials";
import { FAQ } from "../components/FAQ";
import { CTA } from "../components/CTA";
import { GradientBorder } from "../components/ui/GradientBorder";
import { RollingText } from "../components/ui/RollingText";

const PricingFeature = ({ text }: { text: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-1 flex-shrink-0">
      <Sparkles size={14} className="text-cyan-500 fill-cyan-500/20" />
    </div>
    <span className="text-gray-300 text-sm font-medium">{text}</span>
  </div>
);

const PricingCard = ({
  title,
  description,
  price,
  priceSuffix,
  features,
  isPopular,
  buttonVariant = "outline",
  buttonLabel,
  to,
}: {
  title: string;
  description: string;
  price: string;
  priceSuffix?: string;
  features: string[];
  isPopular?: boolean;
  buttonVariant?: "outline" | "gradient";
  buttonLabel: string;
  to: string;
}) => {
  return (
    <div
      className={cn(
        "relative flex flex-col p-8 rounded-3xl border transition-all duration-300 h-full",
        isPopular
          ? "bg-[#0A0A0A] border-teal-500/50 shadow-[0_0_40px_rgba(20,184,166,0.15)]"
          : "bg-[#0A0A0A] border-white/10 hover:border-white/20"
      )}
    >
      {isPopular && (
        <div className="absolute -top-4 right-8 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
          Mais escolhido
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">{price}</span>
          {priceSuffix && (
            <span className="text-gray-500 text-sm">{priceSuffix}</span>
          )}
        </div>
      </div>

      <div className="mb-8">
        {buttonVariant === "gradient" ? (
          <GradientBorder
            gradient="from-teal-500 via-cyan-500 to-teal-600"
            containerClassName="w-full rounded-xl p-[1px]"
            className="rounded-xl"
          >
            <Link
              to={to}
              className="w-full py-3 bg-[#0F0F0F] text-white font-medium rounded-xl hover:bg-black transition-colors relative overflow-hidden group block"
            >
              <span className="relative z-10 block">
                <RollingText text={buttonLabel} className="justify-center" />
              </span>
            </Link>
          </GradientBorder>
        ) : (
          <Link
            to={to}
            className="w-full py-3 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors group block"
          >
            <RollingText text={buttonLabel} className="justify-center" />
          </Link>
        )}
      </div>

      <div className="mt-auto space-y-4">
        <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">
          O que está incluído
        </p>
        {features.map((feature, i) => (
          <PricingFeature key={i} text={feature} />
        ))}
      </div>
    </div>
  );
};

export const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );

  const isMonthly = billingCycle === "monthly";

  const ecosystemFeatures = [
    "Agente de IA no WhatsApp: registre gastos por texto, foto do cupom ou áudio",
    "Alertas de vencimento de IPVA, licenciamento, seguro e CNH",
    "Controle de combustível, peças, revisões, pneus e multas",
    "Controle de km e manutenção por quilometragem",
    "Relatórios e análises dos gastos do seu carro",
    "Avaliação FIPE e pedido de recompra",
    "Indique e Ganhe (comissão via PIX)",
  ];

  const plans = [
    {
      title: "Totex Care",
      description: "Sem cupom de loja parceira — o plano completo",
      price: isMonthly ? "R$ 109,90" : "R$ 1.099",
      priceSuffix: isMonthly ? "/mês" : "/ano",
      features: ecosystemFeatures,
      isPopular: false,
      buttonVariant: "outline" as const,
      buttonLabel: "Começar 7 dias grátis",
      to: "/entrar?tab=register",
    },
    {
      title: "Totex Care — Ecossistema",
      description:
        "Com cupom de uma loja parceira TotexMotors você economiza 90%",
      price: isMonthly ? "R$ 10,99" : "R$ 109,90",
      priceSuffix: isMonthly ? "/mês" : "/ano",
      features: [
        "Tudo do Totex Care, com 90% de desconto",
        ...ecosystemFeatures,
      ],
      isPopular: true,
      buttonVariant: "gradient" as const,
      buttonLabel: "Assinar com cupom",
      to: "/plans",
    },
  ];

  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      {/* --- HEADER --- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 text-center mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-1.5 mb-8"
        >
          <span className="text-[10px] md:text-xs font-bold tracking-widest text-white uppercase">
            PLANOS E PREÇOS
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-12 drop-shadow-xl"
        >
          Controle os gastos do <br />
          seu carro por R$ 10,99/mês
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto -mt-6 mb-12"
        >
          7 dias grátis, sem precisar de cartão pra começar. Com o cupom de uma
          loja parceira TotexMotors você paga 90% menos.
        </motion.p>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex bg-[#0A0A0A] border border-white/10 rounded-full p-1 relative"
        >
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 relative z-10",
              billingCycle === "monthly"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 relative z-10",
              billingCycle === "yearly"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            Anual
          </button>

          {/* Active Background Pill */}
          <div
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-300 shadow-lg",
              billingCycle === "monthly" ? "left-1" : "left-[calc(50%+4px)]"
            )}
          />
        </motion.div>
      </div>

      {/* --- PRICING CARDS --- */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="h-full"
            >
              <PricingCard {...plan} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mb-20">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-gray-400">
            Donos de carro de todo o Brasil já usam a TotexCar Co-pilot
          </p>
        </div>
        <TrustLogos />
      </div>

      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
};
