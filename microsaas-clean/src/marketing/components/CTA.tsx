import React from "react";
import { motion } from "framer-motion";
import { GradientBorder } from "./ui/GradientBorder";
import { RollingText } from "./ui/RollingText";
import { Link } from "react-router-dom";

export const CTA = () => {
  return (
    <section className="relative w-full py-32 overflow-hidden z-20">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[40vw] h-[40vw] bg-teal-600/20 blur-[120px] rounded-full opacity-60" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[40vw] h-[40vw] bg-cyan-600/20 blur-[120px] rounded-full opacity-60" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight mb-6"
        >
          Comece a controlar os gastos <br />
          do seu carro hoje
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-gray-300 mb-12 max-w-2xl mx-auto"
        >
          Crie sua conta no TotexCar Co-pilot e deixe a inteligência artificial
          registrar seus gastos pelo WhatsApp. 7 dias grátis, sem precisar de cartão.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto"
        >
          <GradientBorder
            gradient="from-teal-500 via-cyan-500 to-teal-600"
            containerClassName="rounded-full p-[1.5px] w-full sm:w-auto"
          >
            <Link
              to="/entrar?tab=register"
              className="w-full sm:w-auto px-8 py-3.5 bg-black text-white font-medium rounded-full hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 group"
            >
              <RollingText text="Começar grátis" />
            </Link>
          </GradientBorder>

          <Link
            to="/pricing"
            className="w-full sm:w-auto px-8 py-3.5 text-white font-medium border border-white/20 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm flex items-center justify-center gap-2 group"
          >
            <RollingText text="Ver planos" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
