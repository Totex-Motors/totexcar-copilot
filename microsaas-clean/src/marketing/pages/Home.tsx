import React from 'react';
import { Hero } from '../components/Hero';
import { InteractiveDemo } from '../components/InteractiveDemo';
import { TrustLogos } from '../components/TrustLogos';
import { Features } from '../components/Features';
import { InstantActions } from '../components/InstantActions';
import { StackedCards } from '../components/StackedCards';
import { ScaleManage } from '../components/ScaleManage';
import { IntegrationsTicker } from '../components/IntegrationsTicker';
import { Testimonials } from '../components/Testimonials';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { FAQ } from '../components/FAQ';
import { CTA } from '../components/CTA';

export const Home = () => {
  return (
    <>
      <Hero />
      <InteractiveDemo />
      <TrustLogos />
      <Features />
      {/* Merged Header + Instant Actions Card */}
      <InstantActions />
      
      {/* Stacked Cards */}
      <StackedCards />

      {/* Carousel Dashboard */}
      <ScaleManage />
      {/* Integrations Ticker */}
      <IntegrationsTicker />
      
      {/* New Sections */}
      <Testimonials />
      <WorkflowSteps />
      
      {/* Final Sections */}
      <FAQ />
      <CTA />
    </>
  );
};
