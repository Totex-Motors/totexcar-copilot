import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";

const ScrollToAnchor = () => {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (hash) {
      const id = hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
};

// Layout do site público (landing/marketing): fundo escuro + navbar + footer.
// As páginas do app (dashboard, /entrar, /admin etc.) NÃO usam este layout.
// Usa `children` quando montado direto (rota "/"); senão renderiza <Outlet/> (rotas aninhadas).
export const MarketingLayout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-teal-500/30 font-sans overflow-x-hidden">
      <ScrollToAnchor />
      <Navbar />
      {children ?? <Outlet />}
      <Footer />
    </div>
  );
};

export default MarketingLayout;
