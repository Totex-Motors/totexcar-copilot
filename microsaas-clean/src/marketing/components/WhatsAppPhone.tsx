import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

// Mockup de celular mostrando a conversa REAL com o Co-pilot no WhatsApp.
// O produto é o protagonista: nada de "temos IA" — a gente mostra a IA respondendo.
export type Bubble = { me?: boolean; text: ReactNode };

export function WhatsAppPhone({ bubbles, title = "TotexCar Co-pilot", minHeight = 420, delay = 0 }: { bubbles: Bubble[]; title?: string; minHeight?: number; delay?: number }) {
  return (
    <div className="rounded-[2.2rem] border border-white/10 bg-[#0b141a] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.85)] overflow-hidden">
      <div className="flex items-center gap-3 bg-[#1f2c33] px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-white">{title}</p>
          <p className="text-[11px] text-teal-300 mt-0.5">online</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-4" style={{ minHeight }}>
        {bubbles.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: delay + i * 0.25 }}
            className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow ${
              b.me ? "self-end bg-[#005c4b] text-white rounded-tr-sm" : "self-start bg-[#1f2c33] text-gray-100 rounded-tl-sm"
            }`}
          >
            {b.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
