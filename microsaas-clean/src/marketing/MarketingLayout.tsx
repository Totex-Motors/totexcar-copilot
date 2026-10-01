import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CSS, Nav, useEditorialFonts } from "./editorial";

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

// Layout do site público (páginas internas): sistema editorial (../editorial.tsx) + nav fixa mínima.
// Cada página fecha com <Closing/> (que já traz o rodapé). As páginas do app (dashboard, /entrar, /admin…) NÃO usam isto.
export const MarketingLayout = ({ children }: { children?: React.ReactNode }) => {
  useEditorialFonts();
  return (
    <div className="h2x">
      <style>{CSS}</style>
      <ScrollToAnchor />
      <Nav />
      {children ?? <Outlet />}
    </div>
  );
};

export default MarketingLayout;
