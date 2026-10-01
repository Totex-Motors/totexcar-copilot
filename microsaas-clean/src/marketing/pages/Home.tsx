import React from 'react';
import { Hero } from '../components/Hero';
import { DemoVideo } from '../components/DemoVideo';
import { PainSection } from '../components/PainSection';
import { CopilotChat } from '../components/CopilotChat';
import { SmartAlerts } from '../components/SmartAlerts';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { FreeSection } from '../components/FreeSection';
import { ContextualServices } from '../components/ContextualServices';
import { BeforeAfter } from '../components/BeforeAfter';
import { TrustData } from '../components/TrustData';
import { QrSticker } from '../components/QrSticker';
import { FAQ } from '../components/FAQ';
import { CTA } from '../components/CTA';
import { StickyCta } from '../components/StickyCta';

// HOME — conta uma história: curiosidade → dor → descoberta → demonstração → desejo → confiança → ação.
// Posicionamento: "copiloto do carro" (grátis), não "app de controle de gastos".
// Régua: "não parece uma loja tentando me vender um carro; parece a tecnologia que deveria vir com o carro".
// Sem prova social fabricada (logos placeholder / depoimentos fictícios foram removidos).
export const Home = () => {
  return (
    <>
      <Hero />
      <DemoVideo />
      <PainSection />
      <CopilotChat />
      <SmartAlerts />
      <div id="como-funciona"><WorkflowSteps /></div>
      <FreeSection />
      <ContextualServices />
      <BeforeAfter />
      <TrustData />
      <QrSticker />
      <FAQ />
      <CTA />
      <StickyCta />
    </>
  );
};
