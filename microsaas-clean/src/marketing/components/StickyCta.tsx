import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// CTA fixo no celular, só depois que o visitante passou do Hero. Discreto, uma ação.
export const StickyCta = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 p-3 transition-transform duration-300 ${show ? "translate-y-0" : "translate-y-full"}`}>
      <Link to="/entrar?tab=register" className="block w-full text-center py-3.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold shadow-[0_10px_40px_-10px_rgba(20,184,166,0.7)]">
        Começar grátis
      </Link>
    </div>
  );
};
