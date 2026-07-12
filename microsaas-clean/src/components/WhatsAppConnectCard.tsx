import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, ExternalLink, X } from "lucide-react";

// Número do agente no WhatsApp (somente dígitos, com DDI 55)
const AGENT_NUMBER = "5515981615862";
const WELCOME_MSG =
  "Oi, TotexCar Co-pilot! Acabei de criar minha conta e quero começar a organizar os gastos do meu carro 🚗";
const WHATSAPP_LINK = `https://wa.me/${AGENT_NUMBER}?text=${encodeURIComponent(WELCOME_MSG)}`;
const DISMISS_KEY = "totex_wa_connect_dismissed";

// Card de boas-vindas no dashboard: direciona o cliente pro assistente no WhatsApp.
// Aparece até ser dispensado (localStorage). Some após o primeiro "fechar".
export function WhatsAppConnectCard() {
  const [hidden, setHidden] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );
  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ }
    setHidden(true);
  };

  return (
    <div className="relative rounded-2xl border border-green-500/30 bg-green-500/[0.06] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-11 h-11 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
        <MessageCircle className="w-6 h-6 text-green-600" />
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <h3 className="font-bold leading-tight">Ative o TotexCar Co-pilot no WhatsApp</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Mande foto do cupom, do hodômetro, de multa, áudio ou texto — o Co-pilot registra os gastos, mede seu
          consumo (km/L) e gera recurso de multa. Comece com uma mensagem.
        </p>
      </div>

      <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="flex-shrink-0">
        <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full sm:w-auto">
          <MessageCircle className="w-4 h-4" /> Abrir WhatsApp <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </a>
    </div>
  );
}

export default WhatsAppConnectCard;
