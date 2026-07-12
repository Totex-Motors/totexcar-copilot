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

export const PrivacyPolicy = () => {
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
              POLÍTICA DE PRIVACIDADE
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight mb-6"
          >
            Política de Privacidade
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
          <Section title="Quem somos" delay={0.3}>
            <p>
              O TotexCar Co-pilot é um aplicativo de controle financeiro dos gastos do seu carro, oferecido pela TotexMotors. Esta política explica, de forma clara e em conformidade com a Lei Geral de Proteção de Dados (LGPD), como tratamos as suas informações quando você usa o app e os serviços relacionados.
            </p>
          </Section>

          <Section title="Dados que coletamos" delay={0.4}>
            <p>
              Para oferecer o serviço, podemos coletar dados que você informa, como nome, e-mail, telefone, número do WhatsApp e dados do seu veículo e da sua CNH. Também tratamos os gastos que você registra (combustível, peças, revisões, seguro, IPVA, licenciamento, multas e pneus), inclusive quando enviados por texto, foto do cupom ou áudio ao nosso agente de inteligência artificial. Registramos ainda informações de uso do app para melhorar a sua experiência.
            </p>
          </Section>

          <Section title="Como usamos seus dados" delay={0.5}>
            <p>
              Usamos suas informações para registrar e organizar os gastos do seu carro, enviar alertas de vencimento (como IPVA, seguro, licenciamento e CNH), acompanhar a quilometragem e a manutenção, gerar relatórios, consultar a tabela FIPE e operar recursos como recompra e Indique e Ganhe. Não vendemos seus dados pessoais. Compartilhamos informações apenas com parceiros necessários para a prestação do serviço e quando exigido por lei.
            </p>
          </Section>

          <Section title="Seus direitos (LGPD)" delay={0.6}>
            <p>
              Você pode, a qualquer momento, solicitar acesso aos seus dados, corrigir informações incorretas, pedir a exclusão da conta e dos dados, ou revogar consentimentos. Também pode gerenciar os alertas e mensagens que recebe pelo WhatsApp. Adotamos medidas de segurança, como criptografia e servidores protegidos, para manter suas informações seguras. Nenhum sistema é totalmente imune a riscos, mas trabalhamos continuamente para minimizá-los.
            </p>
          </Section>

          <Section title="Fale com a gente" delay={0.7}>
            <p>
              Se tiver dúvidas sobre esta política ou quiser exercer seus direitos sobre os dados, fale com a TotexMotors pelo e-mail <strong className="text-white">contato@totexmotors.com</strong>. Transparência faz parte do nosso trabalho e respondemos suas solicitações o mais rápido possível.
            </p>
          </Section>
        </div>

      </div>

      {/* --- CTA SECTION --- */}
      <CTA />

    </div>
  );
};
