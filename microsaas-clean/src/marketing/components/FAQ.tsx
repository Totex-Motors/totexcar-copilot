import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { RollingText } from "./ui/RollingText";

const faqs = [
  {
    question: "Como registro um gasto?",
    answer:
      "É só mandar uma mensagem no WhatsApp do TotexCar Co-pilot dizendo o que pagou. A inteligência artificial entende e registra o gasto sozinha, na categoria certa: combustível, peças, revisão, seguro, IPVA, multa e muito mais.",
  },
  {
    question: "Funciona por foto do cupom e por áudio?",
    answer:
      "Sim! Você pode mandar a foto do cupom do posto ou da oficina, gravar um áudio falando o que pagou ou simplesmente escrever uma mensagem. A IA lê tudo, registra o gasto e ainda atualiza a quilometragem do seu carro.",
  },
  {
    question: "Como recebo alertas de vencimento?",
    answer:
      "O TotexCar Co-pilot acompanha as datas do seu veículo e da sua CNH e te avisa pelo WhatsApp antes de vencer: IPVA, licenciamento, seguro e até a revisão por quilometragem. Você nunca mais perde um prazo.",
  },
  {
    question: "Preciso instalar algo?",
    answer:
      "Não precisa instalar nenhum aplicativo. Você usa o TotexCar Co-pilot direto pelo WhatsApp para registrar os gastos e acessa o painel completo com gráficos e relatórios pelo navegador, no celular ou no computador.",
  },
  {
    question: "Quanto custa? Tem teste grátis?",
    answer:
      "Você começa com 7 dias grátis. Depois, o plano Totex Care custa R$109,90/mês. Quem é do ecossistema TotexMotors paga apenas R$10,99/mês (90% de desconto) — e no plano anual, R$109,90 à vista, você leva 12 meses pelo preço de 10 (~17% de desconto). O pagamento é via PIX ou cartão pela Asaas.",
  },
  {
    question: "Meus dados estão seguros?",
    answer:
      "Sim. Levamos a segurança a sério: seus dados ficam protegidos e criptografados, e só você tem acesso às informações do seu carro e dos seus gastos. Nada é compartilhado sem a sua autorização.",
  },
];

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="w-full py-24 px-6 relative z-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
        {/* Left Column: Header */}
        <div className="flex flex-col justify-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight leading-[1.1] mb-8"
          >
            Perguntas <br />
            frequentes
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <h3 className="text-xl font-medium text-white">
                Ficou com alguma dúvida?
              </h3>
              <p className="text-gray-400 text-lg leading-relaxed max-w-md">
                Fala com a gente! É só entrar em contato que nossa equipe te responde rapidinho.
              </p>
            </div>

            <button
              className="w-fit px-8 py-3 rounded-full border border-white/20 text-white font-medium hover:bg-white/10 transition-colors group"
              name="contact-us"
            >
              <RollingText text="Fale conosco" />
            </button>
          </motion.div>
        </div>

        {/* Right Column: Accordion */}
        <div className="flex flex-col gap-4 justify-center">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-gradient-to-br from-[#0A0A0A] to-[#050505] border border-white/10 rounded-2xl overflow-hidden"
            >
              <button
                name={`faq-${index}`}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-lg md:text-xl font-medium text-white pr-8">
                  {faq.question}
                </span>
                <div className="flex-shrink-0 text-gray-400">
                  {openIndex === index ? (
                    <Minus size={20} />
                  ) : (
                    <Plus size={20} />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-6 pb-6 text-gray-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
