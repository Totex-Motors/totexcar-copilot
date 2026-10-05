import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Etiqueta QR do para-brisa: /q/{token}. Conta o scan (edge `etiqueta`) e manda pro WhatsApp do
// Co-pilot com "#etiqueta <token>" pré-preenchido. Nenhum dado do cliente passa por aqui.
export default function Etiqueta() {
  const { token } = useParams();
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("etiqueta", { body: { action: "scan", token } });
        if (cancelled) return;
        if (error || !data?.wa_link) { setErro("Não reconheci essa etiqueta. Confere se o QR está inteiro e tenta de novo."); return; }
        setLink(data.wa_link);
        window.location.replace(data.wa_link);
      } catch {
        if (!cancelled) setErro("Não consegui abrir agora. Tenta de novo em instantes.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b0c0e] text-white">
      <div className="text-center max-w-sm space-y-4">
        <p className="text-3xl">🚗</p>
        {erro ? (
          <>
            <h1 className="text-lg font-semibold">{erro}</h1>
            <a className="inline-block rounded-full bg-[#2DD4BF] text-black font-semibold px-5 py-2.5" href={`https://wa.me/5511963786699?text=${encodeURIComponent("Oi! Escaneei a etiqueta do meu carro mas o QR não abriu 🚗")}`}>Falar com o Co‑pilot</a>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2DD4BF] mx-auto" />
            <h1 className="text-lg font-semibold">Abrindo o Co‑pilot no seu WhatsApp…</h1>
            {link && <a className="inline-block rounded-full bg-[#2DD4BF] text-black font-semibold px-5 py-2.5" href={link}>Se não abrir, toca aqui</a>}
          </>
        )}
        <p className="text-xs text-white/50">TotexCar Co‑pilot · seu carro te avisa quando cuidar</p>
      </div>
    </div>
  );
}
