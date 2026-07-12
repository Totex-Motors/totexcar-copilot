import { Button } from "@/components/ui/button";
import { Lock, Check, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaywallScreenProps {
  userName?: string;
  onLogout?: () => void;
}

// Tela de bloqueio total: aparece quando o trial expirou e o cliente não assinou
// (ou a assinatura ficou vencida/cancelada). O app só volta a funcionar após o pagamento.
export function PaywallScreen({ userName, onLogout }: PaywallScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-premium-lg p-8 text-center space-y-6">
        <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {userName ? `${userName}, seu acesso expirou` : "Seu acesso expirou"}
          </h1>
          <p className="text-muted-foreground">
            Seu período gratuito terminou. Para continuar com o <strong>TotexCar Co-pilot</strong> cuidando
            do seu carro no WhatsApp, ative sua assinatura.
          </p>
        </div>

        <div className="rounded-xl bg-muted/50 p-4 text-left space-y-2">
          {[
            "Registro de gastos por texto, foto ou áudio no WhatsApp",
            "Consumo real (km/L) e custo por km pela foto do hodômetro",
            "Multas com IA: análise de falhas + recurso pronto e alerta de prazo",
            "Modo PRO p/ motorista de app: lucro da semana e por km",
            "Alertas de IPVA, licenciamento, seguro, CNH, parcelas e revisão por km",
            "Financiamento, relatórios, avaliação FIPE, recompra e Indique e Ganhe",
            "Suporte com IA no app e no WhatsApp",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full bg-gradient-primary text-white font-semibold"
            onClick={() => navigate("/plans")}
          >
            Assinar agora
          </Button>
          <p className="text-xs text-muted-foreground">
            A partir de <span className="font-semibold">R$ 10,99/mês</span> com cupom de loja parceira.
          </p>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        )}
      </div>
    </div>
  );
}
