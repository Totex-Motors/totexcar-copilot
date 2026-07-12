import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { GradientBorder } from "./ui/GradientBorder";
import { RollingText } from "./ui/RollingText";
import { motion } from "framer-motion";

export const Hero = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // O vídeo começa mudo (exigência dos navegadores p/ autoplay) e ativa o som
  // no primeiro gesto do usuário (toque, scroll ou tecla).
  useEffect(() => {
    const enableSound = () => {
      const v = videoRef.current;
      if (v) {
        v.muted = false;
        v.volume = 1;
        v.play().catch(() => { /* ignore */ });
      }
    };
    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });
    window.addEventListener("scroll", enableSound, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
      window.removeEventListener("scroll", enableSound);
    };
  }, []);

  return (
    <div className="relative w-full min-h-[90vh] md:min-h-[95vh] overflow-hidden flex flex-col items-center justify-center pt-24 pb-16 md:pb-48">
      {/* Background Video/Effect */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover opacity-20 mix-blend-overlay"
        >
          <source
            src="https://69sfgmk1pv2omedb.public.blob.vercel-storage.com/new-templates/converge-ai/bgVid.webm"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/90 via-transparent to-[#050505]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center text-center justify-center h-full mt-10 md:mt-0">
        {/* Tagline */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-950/10 backdrop-blur-md px-4 py-1.5 shadow-[0_0_20px_rgba(20,184,166,0.1)]">
            <span className="text-[10px] md:text-xs font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-teal-400">
              Controle do seu carro no WhatsApp com IA
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[1.1] mb-8 max-w-6xl drop-shadow-2xl"
        >
          Mandou no WhatsApp, <br />
          tá <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-600">anotado.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 text-lg md:text-xl max-w-3xl leading-relaxed mb-12 font-light"
        >
          Mande foto do cupom, áudio ou texto e a IA registra o gasto do seu carro sozinha.
          Combustível, peças, revisões, IPVA, seguro — tudo organizado, sem planilha.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-10"
        >
          <GradientBorder
            gradient="from-teal-500 via-cyan-500 to-teal-600"
            containerClassName="rounded-full p-[1px]"
          >
            <Link
              to="/entrar?tab=register"
              className="px-10 py-4 bg-black text-white font-semibold rounded-full hover:bg-gray-900 transition-all flex items-center gap-2 group"
            >
              <RollingText text="Começar grátis" />
            </Link>
          </GradientBorder>

          <Link
            to="/pricing"
            className="px-10 py-4 text-white font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors backdrop-blur-sm group"
          >
            <RollingText text="Ver Preços" />
          </Link>
        </motion.div>

        {/* Vídeo de demonstração */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-2xl mb-10"
        >
          <video
            ref={videoRef}
            src="/landing-demo.mp4"
            autoPlay
            loop
            muted
            playsInline
            controls
            className="w-full h-auto rounded-2xl border border-white/10 shadow-2xl shadow-teal-500/10"
          />
        </motion.div>
      </div>
    </div>
  );
};
