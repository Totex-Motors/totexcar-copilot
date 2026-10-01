import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Vídeo REAL do produto (gravação de tela). Começa mudo (exigência dos navegadores p/ autoplay)
// e ativa o som no primeiro gesto do usuário.
export const DemoVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const enableSound = () => {
      const v = videoRef.current;
      if (v) { v.muted = false; v.volume = 1; v.play().catch(() => { /* */ }); }
    };
    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
    };
  }, []);

  return (
    <section className="relative z-10 w-full px-6 pb-20">
      <div className="max-w-3xl mx-auto">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-xs font-bold tracking-widest uppercase text-teal-400 mb-4">
          Veja funcionando
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <video
            ref={videoRef}
            src="/landing-demo.mp4"
            autoPlay loop muted playsInline controls
            className="w-full h-auto rounded-2xl border border-white/10 shadow-2xl shadow-teal-500/10"
          />
        </motion.div>
      </div>
    </section>
  );
};
