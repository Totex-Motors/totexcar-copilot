import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, MessageCircle, ChevronRight } from "lucide-react";

// Página PÚBLICA da Comunidade TotexMotors — topo de funil (playbook Canal+Comunidade).
// Apresenta a proposta, lista os grupos temáticos com botão de entrar e puxa pro Co-pilot.
// Config (links dos grupos) vem da função pública "comunidade" (o dono preenche no app_settings).
const WA = "5511963786699";
const NEON = "#2FE6D6";

type Grupo = { nome: string; emoji: string; desc: string; link: string };

export default function Comunidade() {
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [comunidadeLink, setComunidadeLink] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("comunidade", { body: {} });
        const d = data as any;
        setGrupos(Array.isArray(d?.grupos) ? d.grupos : []);
        setComunidadeLink(d?.comunidade_link || null);
      } catch { /* mostra a página mesmo sem config */ }
      finally { setLoading(false); }
    })();
  }, []);

  const copilot = `https://wa.me/${WA}?text=${encodeURIComponent("Oi! Vim da Comunidade TotexMotors 🚗 Quero saber mais.")}`;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8" style={{ colorScheme: "dark" }}>
      <div className="w-full max-w-md flex flex-col items-center">
        <img src="/totexmotors-logo.png" alt="TotexMotors" className="h-14 w-auto mb-6 object-contain" />

        {/* hero */}
        <div className="w-full rounded-3xl p-6 text-center"
          style={{ background: "rgba(47,230,214,.06)", border: `1px solid rgba(47,230,214,.28)`, boxShadow: "0 0 34px rgba(47,230,214,.18)" }}>
          <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: NEON }}>
            <Users className="w-4 h-4" /> Comunidade TotexMotors
          </div>
          <h1 className="text-2xl font-extrabold leading-tight mt-2">Onde carro bom encontra dono certo 🚗</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Ofertas reais, oportunidades <b className="text-neutral-200">abaixo da FIPE</b> e avaliação grátis do seu carro — direto no WhatsApp, sem spam. Entre nos grupos que combinam com você.
          </p>
        </div>

        {/* grupos */}
        <div className="w-full mt-5 space-y-3">
          {loading ? (
            <div className="py-10 text-center text-neutral-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : grupos.length ? (
            grupos.map((g, i) => {
              const temLink = !!g.link;
              const Card = (
                <div className="w-full rounded-2xl p-4 flex items-center gap-3 transition"
                  style={{ background: "#0a0a0a", border: `1px solid ${temLink ? "rgba(47,230,214,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                  <div className="text-2xl w-9 text-center shrink-0">{g.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold leading-tight">{g.nome}</div>
                    {g.desc && <div className="text-xs text-neutral-400 mt-0.5">{g.desc}</div>}
                  </div>
                  {temLink ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold" style={{ color: NEON }}>
                      Entrar <ChevronRight className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-neutral-600">em breve</span>
                  )}
                </div>
              );
              return temLink ? (
                <a key={i} href={g.link} target="_blank" rel="noreferrer" className="block active:scale-[0.99]">{Card}</a>
              ) : (
                <div key={i} className="opacity-60">{Card}</div>
              );
            })
          ) : (
            <div className="py-8 text-center text-neutral-500 text-sm">Os grupos estão sendo abertos. Fala com a gente no WhatsApp que já te coloco. 👇</div>
          )}
        </div>

        {/* CTA principal da comunidade (guarda-chuva) */}
        {comunidadeLink && (
          <a href={comunidadeLink} target="_blank" rel="noreferrer" className="w-full mt-4">
            <button className="w-full h-12 rounded-xl font-bold text-black flex items-center justify-center gap-2"
              style={{ background: NEON, boxShadow: "0 0 18px rgba(47,230,214,0.5)" }}>
              <Users className="w-5 h-5" /> Entrar na Comunidade
            </button>
          </a>
        )}

        {/* fala com o Co-pilot */}
        <a href={copilot} target="_blank" rel="noreferrer" className="w-full mt-2">
          <button className="w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            style={{ background: "#1FA855", boxShadow: "0 0 16px rgba(31,168,85,0.4)" }}>
            <MessageCircle className="w-5 h-5" /> Falar com o Co-pilot no WhatsApp
          </button>
        </a>

        <p className="text-xs text-neutral-500 text-center mt-8 leading-relaxed">
          <span className="italic">Autonomia pra você, negócio justo pras duas pontas.</span><br />
          TotexMotors · compra, venda e avaliação de carros com quem entende.
        </p>
      </div>
    </div>
  );
}
