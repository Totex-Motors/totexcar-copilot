import React from 'react';
import { cn } from '../lib/utils';

const LogoIpsum1 = () => (
  <svg width="140" height="30" viewBox="0 0 140 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-100">
    <path d="M25.1 15C25.1 20.5 20.6 25 15.1 25C9.6 25 5.1 20.5 5.1 15C5.1 9.5 9.6 5 15.1 5C20.6 5 25.1 9.5 25.1 15Z" fill="currentColor"/>
    <path d="M15.1 0C6.8 0 0 6.8 0 15C0 23.2 6.8 30 15.1 30C23.4 30 30.2 23.2 30.2 15C30.2 6.8 23.4 0 15.1 0ZM15.1 25C9.6 25 5.1 20.5 5.1 15C5.1 9.5 9.6 5 15.1 5C20.6 5 25.1 9.5 25.1 15C25.1 20.5 20.6 25 15.1 25Z" fill="currentColor" fillOpacity="0.5"/>
    <text x="40" y="21" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="16" fill="currentColor">TotexMotors</text>
  </svg>
);

const LogoIpsum2 = () => (
  <svg width="160" height="30" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-100">
    <path d="M15 0L28 7.5V22.5L15 30L2 22.5V7.5L15 0Z" fill="currentColor"/>
    <circle cx="15" cy="15" r="6" fill="black"/>
    <text x="40" y="21" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="16" fill="currentColor">Lojas Parceiras</text>
  </svg>
);

const CompanyLogo = () => (
  <svg width="150" height="30" viewBox="0 0 150 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-100">
    <rect x="0" y="5" width="20" height="20" rx="4" fill="currentColor"/>
    <rect x="10" y="0" width="20" height="20" rx="4" fill="currentColor" fillOpacity="0.5"/>
    <text x="40" y="21" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="16" fill="currentColor">Avaliação FIPE</text>
  </svg>
);

const BusinessLogo = () => (
  <svg width="160" height="30" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-100">
    <path d="M15 0L30 15L15 30L0 15L15 0Z" fill="currentColor"/>
    <text x="40" y="21" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="16" fill="currentColor">Indique e Ganhe</text>
  </svg>
);

const logos = [LogoIpsum1, LogoIpsum2, CompanyLogo, LogoIpsum1, BusinessLogo, LogoIpsum2, CompanyLogo];

export const TrustLogos = () => {
  return (
    <section className="w-full py-12 overflow-hidden border-t border-white/5 relative z-20">
      <div className="relative w-full max-w-[100vw] flex">
        {/* Gradient Masks for smooth fade out at edges - Updated to match new bg */}
        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-16 bg-gradient-to-r from-[#050505] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-16 bg-gradient-to-l from-[#050505] to-transparent z-10" />

        {/* Scrolling Container — mais rápido que o ticker padrão */}
        <div className="flex items-center gap-16 animate-scroll [animation-duration:22s] whitespace-nowrap">
          {/* First set of logos */}
          <div className="flex items-center gap-16 min-w-full">
            {logos.map((Logo, index) => (
              <div key={`logo-1-${index}`} className="text-white">
                <Logo />
              </div>
            ))}
          </div>
          {/* Duplicate set for seamless loop */}
          <div className="flex items-center gap-16 min-w-full">
            {logos.map((Logo, index) => (
              <div key={`logo-2-${index}`} className="text-white">
                <Logo />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
