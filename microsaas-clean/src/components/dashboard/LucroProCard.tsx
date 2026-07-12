import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp, TrendingDown, Route, X, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useLucroSemana, useSetDriverMode } from "@/hooks/useLucro";
import { toast } from "@/hooks/use-toast";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const DISMISS_KEY = "totex_pro_offer_dismissed";

// Modo Motorista PRO no dashboard:
// - driver_mode OFF → convite "trabalha com aplicativo?" (dispensável)
// - driver_mode ON  → lucro da semana (faturou/gastou/sobrou + lucro por km)
export function LucroProCard() {
  const { userData, userId } = useCurrentUser();
  const driverMode = Boolean((userData as any)?.driver_mode);
  const { data: lucro, isLoading } = useLucroSemana(userId, driverMode);
  const setMode = useSetDriverMode();
  const [hidden, setHidden] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  if (!driverMode) {
    if (hidden) return null;
    return (
      <div className="relative rounded-2xl border border-primary/30 bg-primary/[0.05] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ } setHidden(true); }}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-bold leading-tight">Você trabalha com aplicativo? (Uber, 99, táxi…)</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ative o <strong>Modo PRO</strong>: mande o print dos seus ganhos no WhatsApp e descubra quanto
            <strong> sobra de verdade</strong> por semana — e por km rodado.
          </p>
        </div>
        <Button
          disabled={setMode.isPending || !userId}
          onClick={() => setMode.mutate(
            { userId: userId!, on: true },
            {
              onSuccess: () => toast({ title: "Modo PRO ativado! 🚗", description: "Mande o print dos ganhos no WhatsApp que eu calculo seu lucro." }),
              onError: (e: any) => toast({ title: "Não consegui ativar", description: String(e?.message || e), variant: "destructive" }),
            },
          )}
          className="flex-shrink-0"
        >
          {setMode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ativar Modo PRO"}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" /> Lucro da semana <span className="text-xs font-normal text-muted-foreground">(Modo PRO)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !lucro ? (
          <div className="h-16 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-bold ${lucro.lucro >= 0 ? "text-foreground" : "text-destructive"}`}>{brl(lucro.lucro)}</span>
              <span className="text-muted-foreground text-sm pb-1">{lucro.lucro >= 0 ? "sobrou até agora" : "no vermelho"}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5"><TrendingUp className="w-3.5 h-3.5" /> Faturou</div>
                <span className="font-semibold">{brl(lucro.receita)}</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5"><TrendingDown className="w-3.5 h-3.5" /> Gastou</div>
                <span className="font-semibold">{brl(lucro.despesa)}</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5"><Route className="w-3.5 h-3.5" /> Lucro por km</div>
                <span className="font-semibold">{lucro.lucro_por_km != null ? `${brl(lucro.lucro_por_km)} /km` : "—"}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Semana de {lucro.de.split("-").reverse().join("/")} até hoje. Mande prints de ganhos + cupons + foto do
              hodômetro no WhatsApp pra manter tudo em dia. Resumo completo toda segunda! 📊
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LucroProCard;
