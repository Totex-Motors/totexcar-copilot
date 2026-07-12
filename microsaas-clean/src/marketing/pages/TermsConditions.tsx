import React from 'react';
import { motion } from 'framer-motion';
import { CTA } from '../components/CTA';

const Section = ({ title, children, delay }: { title: string, children: React.ReactNode, delay: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    className="mb-16"
  >
    <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6 tracking-tight">
      {title}
    </h2>
    <div className="text-gray-400 text-lg leading-relaxed space-y-4">
      {children}
    </div>
  </motion.div>
);

export const TermsConditions = () => {
  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      
      {/* Background Ambient Glows (Top) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-teal-600/10 blur-[120px] rounded-full opacity-60" />
        <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-cyan-600/10 blur-[120px] rounded-full opacity-60" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 mb-24">
        
        {/* --- HEADER --- */}
        <div className="text-center mb-24">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block border border-white/20 bg-white/5 backdrop-blur-sm rounded-full px-4 py-1.5 mb-8"
          >
            <span className="text-[10px] md:text-xs font-bold tracking-widest text-white uppercase">
              JURÍDICO
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight mb-6"
          >
            Termos e Condições
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-sm md:text-base"
          >
            Última atualização: 15 de novembro de 2024
          </motion.p>
        </div>

        {/* --- CONTENT --- */}
        <div className="border-t border-white/5 pt-16">
          <Section title="Sobre estes Termos" delay={0.3}>
            <p>
              Ao criar uma conta e usar o <strong className="text-white">TotexCar Co-pilot</strong>, aplicativo oferecido pela TotexMotors, você concorda com estes Termos e Condições. Leia com atenção antes de usar o app. Se você não concordar com algum ponto, basta não utilizar o serviço.
            </p>
          </Section>

          <Section title="Como usar o aplicativo" delay={0.4}>
            <p>
              O TotexCar Co-pilot ajuda você a controlar os gastos do seu carro, receber alertas de vencimento e acompanhar a manutenção. Você se compromete a fornecer informações verdadeiras, manter seus dados de acesso em sigilo e usar o app apenas para fins próprios e legais. Os registros e relatórios são ferramentas de organização e não substituem orientação profissional ou contábil.
            </p>
          </Section>

          <Section title="Responsabilidades e limitações" delay={0.5}>
            <p>
              Trabalhamos para manter o serviço disponível e as informações corretas, mas o app é oferecido "<strong className="text-white">no estado em que se encontra</strong>". Dados como tabela FIPE, valores de recompra e consultas por placa dependem de fontes externas e podem sofrer alterações. A TotexMotors não se responsabiliza por multas, prazos perdidos ou decisões tomadas com base nas informações do app. Você é responsável por conferir prazos e valores oficiais.
            </p>
          </Section>

          <Section title="Pagamentos, alterações e cancelamento" delay={0.6}>
            <p>
              Alguns recursos podem ser pagos, com os valores e condições informados no momento da contratação. Podemos atualizar estes Termos a qualquer momento, e o uso contínuo do app significa que você aceita as alterações. Você pode cancelar a sua conta quando quiser, conforme nossa Política de Privacidade.
            </p>
          </Section>

          <Section title="Fale com a gente" delay={0.7}>
            <p>
              Em caso de dúvidas sobre estes Termos, entre em contato com a TotexMotors pelo e-mail <strong className="text-white">contato@totexmotors.com</strong>. Teremos prazer em ajudar e responder o mais rápido possível.
            </p>
          </Section>
        </div>

      </div>

      {/* --- CTA SECTION --- */}
      <CTA />

    </div>
  );
};
