import React from "react";
import { Instagram, Facebook, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";

const FooterLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="text-gray-500 hover:text-white transition-colors text-sm block"
  >
    {children}
  </Link>
);

const SocialIcon = ({ icon: Icon, href }: { icon: any; href: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
  >
    <Icon size={16} />
  </a>
);

export const Footer = () => {
  return (
    <footer className="w-full px-4 md:px-6 pb-12 pt-24 relative z-20">
      <div className="max-w-7xl mx-auto border-t border-white/5 pt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-7 w-auto" />
              <span className="text-white font-bold text-lg">TotexCar Co-pilot</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Controle os gastos do seu carro pelo WhatsApp. A IA lê o cupom, registra o
              gasto e avisa os vencimentos. Um produto do ecossistema TotexMotors.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-white font-semibold text-sm mb-2">Produto</h4>
            <FooterLink to="/pricing">Preços</FooterLink>
            <FooterLink to="/integrations">Recursos</FooterLink>
            <FooterLink to="/entrar?tab=register">Começar grátis</FooterLink>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-white font-semibold text-sm mb-2">Empresa</h4>
            <FooterLink to="/about">Sobre nós</FooterLink>
            <FooterLink to="/blogs">Blog</FooterLink>
            <FooterLink to="/contact">Contato</FooterLink>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-white font-semibold text-sm mb-2">Legal</h4>
            <FooterLink to="/privacy-policy">Política de Privacidade</FooterLink>
            <FooterLink to="/terms-conditions">Termos de Uso</FooterLink>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} TotexMotors. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <SocialIcon icon={Instagram} href="https://instagram.com/totexmotors" />
            <SocialIcon icon={Facebook} href="https://facebook.com/totexmotors" />
            <SocialIcon icon={Linkedin} href="#" />
          </div>
        </div>
      </div>
    </footer>
  );
};
