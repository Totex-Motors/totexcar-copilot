import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel, Route, Gauge, MessageCircle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useConsumo } from "@/hooks/useConsumo";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// Card "Meu consumo": litros vs km rodados, do jeito simples que o dono entende.
// Alimentado pelo TotexCar Co-pilot (foto do cupom + foto do hodômetro no WhatsApp).
export function ConsumoCard() {
  const { userId } = useCurrentUser();
  const { data: consumo, isLoading } = useConsumo(userId);

  return (
    <Card className="border-0 shadow-premium-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Fuel className="w-4 h-4 text-primary" /> Meu consumo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : !consumo ? (
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>Ainda sem medição. Pra eu medir seu consumo:</p>
            <p className="flex items-start gap-1.5">
              <MessageCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <span>
                A cada abastecimento, mande no WhatsApp a <strong>foto do cupom</strong> e a{" "}
                <strong>foto do hodômetro</strong>. A partir do 2º abastecimento eu calculo seu km/L.
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground">{consumo.media_km_por_litro}</span>
              <span className="text-muted-foreground text-sm pb-1">km/L na média</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                  <Route className="w-3.5 h-3.5" /> Último tanque
                </div>
                <span className="font-semibold">
                  {consumo.ultimo.km_rodados.toLocaleString("pt-BR")} km · {consumo.ultimo.litros} L →{" "}
                  {consumo.ultimo.km_por_litro} km/L
                </span>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
                  <Gauge className="w-3.5 h-3.5" /> Custo por km
                </div>
                <span className="font-semibold">{brl(consumo.custo_combustivel_por_km)} /km</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {consumo.abastecimentos_medidos} abastecimento{consumo.abastecimentos_medidos > 1 ? "s" : ""} medido
              {consumo.abastecimentos_medidos > 1 ? "s" : ""} — continue mandando cupom + hodômetro no WhatsApp.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ConsumoCard;
